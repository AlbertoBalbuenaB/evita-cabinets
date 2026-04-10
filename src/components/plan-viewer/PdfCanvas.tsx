import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdf, renderPage } from '../../lib/plan-viewer/pdfLoader';
import { screenToPdf } from '../../lib/plan-viewer/transforms';
import { euclideanDistance, polylineLength } from '../../lib/plan-viewer/geometry';
import { usePlanViewerStore } from '../../hooks/usePlanViewerStore';
import { MeasurementOverlay } from './MeasurementOverlay';
import type { PdfPoint, ToolMode } from '../../lib/plan-viewer/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;
const RENDER_SCALE = 2;

export interface PdfCanvasHandle {
  fitToScreen: () => void;
}

interface PdfCanvasProps {
  file: File | null;
}

export const PdfCanvas = forwardRef<PdfCanvasHandle, PdfCanvasProps>(function PdfCanvas({ file }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [cursorPos, setCursorPos] = useState<PdfPoint | null>(null);

  const store = usePlanViewerStore();
  const { viewport, currentPage, activeTool } = store;

  // Expose fit-to-screen
  useImperativeHandle(ref, () => ({
    fitToScreen: () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      store.fitToScreen(rect.width, rect.height);
    },
  }), [store]);

  // Load PDF
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const doc = await loadPdf(file);
      if (cancelled) return;
      docRef.current = doc;
      store.setPageInfo(doc.numPages, 0, 0);
      store.setCurrentPage(1);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Render current page
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      const { width, height } = await renderPage(doc, currentPage, canvas, RENDER_SCALE);
      if (cancelled) return;
      setCanvasSize({ w: width, h: height });
      store.setPageInfo(doc.numPages, width, height);

      // Auto-fit on first load
      const container = containerRef.current;
      if (container && viewport.zoom === 1 && viewport.offsetX === 0 && viewport.offsetY === 0) {
        const rect = container.getBoundingClientRect();
        store.fitToScreen(rect.width, rect.height);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, file]);

  // Native wheel handler (passive: false to allow preventDefault)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { viewport: vp } = usePlanViewerStore.getState();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));

      usePlanViewerStore.getState().setViewport({
        zoom: newZoom,
        offsetX: mouseX - (mouseX - vp.offsetX) * (newZoom / vp.zoom),
        offsetY: mouseY - (mouseY - vp.offsetY) * (newZoom / vp.zoom),
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Pan + click handling
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const getToolCursor = (tool: ToolMode): string => {
    if (tool === 'pan') return 'grab';
    return 'crosshair';
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const state = usePlanViewerStore.getState();

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
      const pt = screenToPdf(
        e.clientX - rect.left,
        e.clientY - rect.top,
        state.viewport,
        RENDER_SCALE
      );

      const tool = state.activeTool;
      const pts = state.activePoints;

      if (tool === 'calibrate') {
        state.addActivePoint(pt);
        if (pts.length === 1) {
          state.setShowCalibrationModal(true);
        }
      } else if (tool === 'line') {
        state.addActivePoint(pt);
        if (pts.length === 1) {
          finalizeLine(pts[0], pt);
        }
      } else if (tool === 'multiline') {
        state.addActivePoint(pt);
      } else if (tool === 'rectangle') {
        state.addActivePoint(pt);
        if (pts.length === 1) {
          finalizeRect(pts[0], pt);
        }
      }
    },
    [/* stable — reads from getState() */]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const state = usePlanViewerStore.getState();
      state.setViewport({
        offsetX: state.viewport.offsetX + dx,
        offsetY: state.viewport.offsetY + dy,
      });
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const state = usePlanViewerStore.getState();
    const pt = screenToPdf(
      e.clientX - rect.left,
      e.clientY - rect.top,
      state.viewport,
      RENDER_SCALE
    );
    setCursorPos(pt);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    const state = usePlanViewerStore.getState();
    if (state.activeTool === 'multiline' && state.activePoints.length >= 3) {
      // The second click of the double-click added a duplicate point — drop it
      const points = state.activePoints.slice(0, -1);
      finalizeMultiline(points);
    }
  }, []);

  // ── Measurement finalization ──────────────────────────────

  const finalizeLine = useCallback((a: PdfPoint, b: PdfPoint) => {
    const state = usePlanViewerStore.getState();
    if (!state.calibration) return;
    const pxLen = euclideanDistance(a, b);
    const realLen = pxLen / state.calibration.pixelsPerUnit;
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('line'),
      type: 'line',
      color: state.nextColor(),
      page: state.currentPage,
      pointA: a,
      pointB: b,
      pxLength: pxLen,
      realLength: realLen,
      unit: state.unit,
    });
  }, []);

  const finalizeRect = useCallback((a: PdfPoint, b: PdfPoint) => {
    const state = usePlanViewerStore.getState();
    if (!state.calibration) return;
    const pxW = Math.abs(b.x - a.x);
    const pxH = Math.abs(b.y - a.y);
    const realW = pxW / state.calibration.pixelsPerUnit;
    const realH = pxH / state.calibration.pixelsPerUnit;
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('rectangle'),
      type: 'rectangle',
      color: state.nextColor(),
      page: state.currentPage,
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
    const state = usePlanViewerStore.getState();
    if (!state.calibration) return;
    const { segments, total } = polylineLength(points);
    state.addMeasurement({
      id: crypto.randomUUID(),
      name: state.nextName('multiline'),
      type: 'multiline',
      color: state.nextColor(),
      page: state.currentPage,
      points,
      segments: segments.map((s) => s / state.calibration!.pixelsPerUnit),
      totalPxLength: total,
      totalRealLength: total / state.calibration!.pixelsPerUnit,
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
      {/* PDF canvas layer */}
      <canvas
        ref={canvasRef}
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.zoom})`,
          imageRendering: viewport.zoom > 3 ? 'pixelated' : 'auto',
        }}
      />

      {/* SVG measurement overlay */}
      <MeasurementOverlay
        canvasWidth={canvasSize.w}
        canvasHeight={canvasSize.h}
        viewport={viewport}
        renderScale={RENDER_SCALE}
        cursorPos={cursorPos}
      />
    </div>
  );
});
