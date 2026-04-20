import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdf, renderPage, renderImage, isPdf } from '../../lib/takeoff/pdfLoader';
import { screenToPdf } from '../../lib/takeoff/transforms';
import { euclideanDistance, polylineLength, angleBetweenPoints, polygonArea, polygonPerimeter, snapPoint } from '../../lib/takeoff/geometry';
import { pickAt } from '../../lib/takeoff/hitTest';
import { translateMeasurement, updateMeasurementHandle } from '../../lib/takeoff/editMeasurement';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { MeasurementOverlay } from './MeasurementOverlay';
import type { PdfPoint, ToolMode, Measurement, HandleKey } from '../../lib/takeoff/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;
const RENDER_SCALE = 2;

export interface PdfCanvasHandle {
  fitToScreen: () => void;
  getCanvasElement: () => HTMLCanvasElement | null;
  getSvgElement: () => SVGSVGElement | null;
  getContainerElement: () => HTMLDivElement | null;
}

interface PdfCanvasProps {
  file: File | null;
}

export const PdfCanvas = forwardRef<PdfCanvasHandle, PdfCanvasProps>(function PdfCanvas({ file }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const isImageRef = useRef(false);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [cursorPos, setCursorPos] = useState<PdfPoint | null>(null);

  const store = useTakeoffStore();
  const { viewport, currentPage, activeTool } = store;

  useImperativeHandle(ref, () => ({
    fitToScreen: () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      store.fitToScreen(rect.width, rect.height);
    },
    getCanvasElement: () => canvasRef.current,
    getSvgElement: () => svgRef.current,
    getContainerElement: () => containerRef.current,
  }), [store]);

  // Load file (PDF or image)
  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    if (isPdf(file)) {
      isImageRef.current = false;
      (async () => {
        const doc = await loadPdf(file);
        if (cancelled) return;
        docRef.current = doc;
        store.setPageInfo(doc.numPages, 0, 0);
        store.setCurrentPage(1);
      })();
    } else {
      isImageRef.current = true;
      docRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      (async () => {
        const { width, height } = await renderImage(file, canvas, RENDER_SCALE);
        if (cancelled) return;
        setCanvasSize({ w: width, h: height });
        store.setPageInfo(1, width, height);
        store.setCurrentPage(1);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          store.fitToScreen(rect.width, rect.height);
        }
      })();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Render current PDF page
  useEffect(() => {
    if (isImageRef.current) return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      const { width, height } = await renderPage(doc, currentPage, canvas, RENDER_SCALE);
      if (cancelled) return;
      setCanvasSize({ w: width, h: height });
      store.setPageInfo(doc.numPages, width, height);
      const container = containerRef.current;
      if (container && viewport.zoom === 1 && viewport.offsetX === 0 && viewport.offsetY === 0) {
        const rect = container.getBoundingClientRect();
        store.fitToScreen(rect.width, rect.height);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, file]);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { viewport: vp } = useTakeoffStore.getState();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));
      useTakeoffStore.getState().setViewport({
        zoom: newZoom,
        offsetX: mouseX - (mouseX - vp.offsetX) * (newZoom / vp.zoom),
        offsetY: mouseY - (mouseY - vp.offsetY) * (newZoom / vp.zoom),
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Select-tool drag state: holds the original measurement + which handle (if any)
  // is being dragged, so mouseup can commit a single undo entry for the whole drag.
  const dragStateRef = useRef<{
    mode: 'body' | 'handle';
    measurementId: string;
    original: Measurement;
    handleKey?: HandleKey;
    startPdf: PdfPoint;
  } | null>(null);

  const getToolCursor = (tool: ToolMode): string => {
    if (tool === 'pan') return 'grab';
    if (tool === 'annotate') return 'text';
    if (tool === 'select') return 'default';
    return 'crosshair';
  };

  // Apply snap if shift is held
  const applySnap = (pt: PdfPoint, state: ReturnType<typeof useTakeoffStore.getState>): PdfPoint => {
    if (!state.snapEnabled || state.activePoints.length === 0) return pt;
    const anchor = state.activePoints[state.activePoints.length - 1];
    return snapPoint(pt, anchor);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const state = useTakeoffStore.getState();

    if (e.button === 1 || (e.button === 0 && state.activeTool === 'pan')) {
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let pt = screenToPdf(e.clientX - rect.left, e.clientY - rect.top, state.viewport, RENDER_SCALE);

    // Snap if enabled
    if (state.snapEnabled && state.activePoints.length > 0) {
      pt = applySnap(pt, state);
    }

    const tool = state.activeTool;
    const pts = state.activePoints;

    if (tool === 'select') {
      const pageMeasurements = state.measurements.filter((m) => m.page === state.currentPage);
      const zoomScale = state.viewport.zoom * RENDER_SCALE;
      const bodyThreshold = 6 / zoomScale;
      const handleThreshold = 10 / zoomScale;
      const hit = pickAt(pt, pageMeasurements, state.selectedMeasurementId, bodyThreshold, handleThreshold);
      if (!hit) {
        state.selectMeasurement(null);
        return;
      }
      const target = pageMeasurements.find((m) => m.id === hit.measurementId);
      if (!target) return;
      state.selectMeasurement(hit.measurementId);
      dragStateRef.current = {
        mode: hit.kind === 'handle' ? 'handle' : 'body',
        measurementId: hit.measurementId,
        original: target,
        handleKey: hit.kind === 'handle' ? hit.handleKey : undefined,
        startPdf: pt,
      };
      e.preventDefault();
      return;
    }

    if (tool === 'calibrate') {
      state.addActivePoint(pt);
      if (pts.length === 1) state.setShowCalibrationModal(true);
    } else if (tool === 'line') {
      state.addActivePoint(pt);
      if (pts.length === 1) finalizeLine(pts[0], pt);
    } else if (tool === 'multiline') {
      state.addActivePoint(pt);
    } else if (tool === 'rectangle') {
      state.addActivePoint(pt);
      if (pts.length === 1) finalizeRect(pts[0], pt);
    } else if (tool === 'angle') {
      state.addActivePoint(pt);
      if (pts.length === 2) finalizeAngle(pts[0], pts[1], pt);
    } else if (tool === 'polygon') {
      state.addActivePoint(pt);
    } else if (tool === 'annotate') {
      state.setPendingAnnotationPos(pt);
      state.setShowAnnotationInput(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const state = useTakeoffStore.getState();
      state.setViewport({
        offsetX: state.viewport.offsetX + dx,
        offsetY: state.viewport.offsetY + dy,
      });
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const state = useTakeoffStore.getState();
    let pt = screenToPdf(e.clientX - rect.left, e.clientY - rect.top, state.viewport, RENDER_SCALE);

    // Select-tool drag: body → translate; handle → update single point
    const drag = dragStateRef.current;
    if (drag) {
      if (drag.mode === 'body') {
        const dx = pt.x - drag.startPdf.x;
        const dy = pt.y - drag.startPdf.y;
        state.replaceMeasurementLive(drag.measurementId, translateMeasurement(drag.original, dx, dy));
      } else if (drag.mode === 'handle' && drag.handleKey) {
        const cal = state.calibrations[state.currentPage];
        if (cal) {
          state.replaceMeasurementLive(drag.measurementId, updateMeasurementHandle(drag.original, drag.handleKey, pt, cal));
        }
      }
      setCursorPos(pt);
      return;
    }

    if (state.snapEnabled && state.activePoints.length > 0) {
      pt = applySnap(pt, state);
    }
    setCursorPos(pt);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    const drag = dragStateRef.current;
    if (drag) {
      const state = useTakeoffStore.getState();
      const current = state.measurements.find((m) => m.id === drag.measurementId);
      if (current && current !== drag.original) {
        state.commitReplaceMeasurement(drag.original, current);
      }
      dragStateRef.current = null;
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    const state = useTakeoffStore.getState();
    if (state.activeTool === 'multiline' && state.activePoints.length >= 3) {
      finalizeMultiline(state.activePoints.slice(0, -1));
    } else if (state.activeTool === 'polygon' && state.activePoints.length >= 4) {
      finalizePolygon(state.activePoints.slice(0, -1));
    }
  }, []);

  // ── Finalization helpers ──────────────────────────────────

  const finalizeLine = useCallback((a: PdfPoint, b: PdfPoint) => {
    const state = useTakeoffStore.getState();
    const cal = state.calibrations[state.currentPage];
    if (!cal) return;
    const pxLen = euclideanDistance(a, b);
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('line'),
      type: 'line',
      color: state.nextColor(),
      page: state.currentPage,
      group: state.activeGroup,
      pointA: a,
      pointB: b,
      pxLength: pxLen,
      realLength: pxLen / cal.pixelsPerUnit,
      unit: state.unit,
    });
  }, []);

  const finalizeRect = useCallback((a: PdfPoint, b: PdfPoint) => {
    const state = useTakeoffStore.getState();
    const cal = state.calibrations[state.currentPage];
    if (!cal) return;
    const pxW = Math.abs(b.x - a.x);
    const pxH = Math.abs(b.y - a.y);
    const realW = pxW / cal.pixelsPerUnit;
    const realH = pxH / cal.pixelsPerUnit;
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('rectangle'),
      type: 'rectangle',
      color: state.nextColor(),
      page: state.currentPage,
      group: state.activeGroup,
      cornerA: a,
      cornerB: b,
      pxWidth: pxW,
      pxHeight: pxH,
      realWidth: realW,
      realHeight: realH,
      realArea: realW * realH,
      unit: state.unit,
    });
  }, []);

  const finalizeMultiline = useCallback((points: PdfPoint[]) => {
    const state = useTakeoffStore.getState();
    const cal = state.calibrations[state.currentPage];
    if (!cal) return;
    const { segments, total } = polylineLength(points);
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('multiline'),
      type: 'multiline',
      color: state.nextColor(),
      page: state.currentPage,
      group: state.activeGroup,
      points,
      segments: segments.map((s) => s / cal.pixelsPerUnit),
      totalPxLength: total,
      totalRealLength: total / cal.pixelsPerUnit,
      unit: state.unit,
    });
    state.clearActivePoints();
  }, []);

  const finalizeAngle = useCallback((a: PdfPoint, vertex: PdfPoint, c: PdfPoint) => {
    const state = useTakeoffStore.getState();
    const degrees = angleBetweenPoints(a, vertex, c);
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('angle'),
      type: 'angle',
      color: state.nextColor(),
      page: state.currentPage,
      group: state.activeGroup,
      pointA: a,
      vertex,
      pointC: c,
      degrees,
    });
  }, []);

  const finalizePolygon = useCallback((points: PdfPoint[]) => {
    const state = useTakeoffStore.getState();
    const cal = state.calibrations[state.currentPage];
    if (!cal) return;
    const pxPeri = polygonPerimeter(points);
    const pxAr = polygonArea(points);
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('polygon'),
      type: 'polygon',
      color: state.nextColor(),
      page: state.currentPage,
      group: state.activeGroup,
      points,
      pxPerimeter: pxPeri,
      pxArea: pxAr,
      realPerimeter: pxPeri / cal.pixelsPerUnit,
      realArea: pxAr / (cal.pixelsPerUnit * cal.pixelsPerUnit),
      unit: state.unit,
    });
    state.clearActivePoints();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-slate-100"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isPanningRef.current ? 'grabbing' : getToolCursor(activeTool) }}
    >
      <canvas
        ref={canvasRef}
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.zoom})`,
          imageRendering: viewport.zoom > 3 ? 'pixelated' : 'auto',
        }}
      />
      <MeasurementOverlay
        ref={svgRef}
        canvasWidth={canvasSize.w}
        canvasHeight={canvasSize.h}
        viewport={viewport}
        renderScale={RENDER_SCALE}
        cursorPos={cursorPos}
      />
    </div>
  );
});
