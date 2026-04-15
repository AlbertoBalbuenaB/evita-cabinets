/**
 * Draft Tool — Konva canvas (Step 4 + Step 5 wall tool).
 *
 * Renders the active drawing with pan/zoom, grid, selection, drag-drop from
 * the catalog panel, and a click-click wall tool. All world coordinates are
 * millimeters; the Konva stage handles the transform to screen pixels.
 *
 * Coordinate system:
 *   - World:  x increases to the right (mm), y increases upward (mm).
 *   - Konva is y-down by default; we flip the world layer with scaleY={-1}
 *     and offset by canvas height so positive y appears on top of the view.
 *   - Text nodes inside the world layer get an additional scaleY={-1} so
 *     labels read correctly.
 *
 * Scope (Phase 1, Session B):
 *   - Plan and elevation views, single view at a time.
 *   - Cabinets, walls, and custom_piece elements render from the block
 *     renderer primitives.
 *   - Countertops, dimensions, and keyplan arrows are ignored in this
 *     session (they land in Session C / D).
 *   - Selection: single click, shift-click multi, Delete key, arrow-nudge.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { Maximize2, Ruler, Square, Tag as TagIcon } from 'lucide-react';
import { useDraftStore } from '../store/useDraftStore';
import { useCatalog } from '../lib/useCatalog';
import type {
  DrawingElementRow,
  DrawingElementInsert,
  DragPayload,
  WallProps,
  CabinetProps,
  CountertopProps,
  DimensionProps,
} from '../types';
import { DRAG_MIME } from '../types';
import {
  BlockPrimitive,
  getBlockSvg,
  renderCountertop,
  renderDimension,
} from '../svg/blockRenderer';
import { inToMm, formatInchesFractional } from '../utils/format';
import { snapCabinetOnDrop } from './snapHelpers';
import {
  generateCountertopOutlines,
  buildCountertopProps,
} from './countertopGeometry';
import { generateDimensions } from './autoDimension';
import { generateAutoTags } from './autoTag';
import { CountertopModal } from '../panels/CountertopModal';

const GRID_COLOR = 'rgba(99, 102, 241, 0.08)';
const GRID_STRONG = 'rgba(99, 102, 241, 0.22)';
const SELECTION_STROKE = '#6366f1';
const WALL_STROKE = '#334155';
const ELEMENT_STROKE = '#1e293b'; // slate-800 — replaces invalid "currentColor"
const ELEMENT_TEXT = '#334155'; // slate-700 for labels
const DIMENSION_STROKE = '#F58220'; // Evita orange
const COUNTERTOP_FILL = 'rgba(148, 163, 184, 0.15)';
const COUNTERTOP_STROKE = '#475569';
const NUDGE_MM = 3.175; // 1/8"

/** Grid step doubles dynamically at low zoom to avoid visual density overload. */
function gridStep(baseStepMm: number, scale: number): number {
  let step = baseStepMm;
  while (step * scale < 8) step *= 2; // min 8px between lines on screen
  return step;
}
const GRID_STRONG_STEP = inToMm(12); // 12" accent stays fixed

export function DraftCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stageState, setStageState] = useState({
    scale: 0.2, // provisional; replaced by fit-to-view on first render
    x: 400,
    y: 300,
  });
  /** Set by the first auto-fit; prevents re-fitting on every element change. */
  const didInitialFitRef = useRef(false);

  /** Live ref of stageState so screenToWorld always reads fresh values,
   *  even in event handlers that close over a stale render. */
  const stageStateRef = useRef(stageState);
  stageStateRef.current = stageState;

  // Wall tool state (click-click)
  const [wallToolActive, setWallToolActive] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);

  // Manual pan state (replaces Stage draggable — fixes double-offset bug)
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);

  // Countertop modal state
  const [countertopModalOpen, setCountertopModalOpen] = useState(false);

  // Store slices
  const currentDrawing = useDraftStore((s) => s.currentDrawing);
  const currentView = useDraftStore((s) => s.currentView);
  const currentAreaId = useDraftStore((s) => s.currentAreaId);
  const currentElevationId = useDraftStore((s) => s.currentElevationId);
  const elements = useDraftStore((s) => s.elements);
  const areas = useDraftStore((s) => s.areas);
  const elevations = useDraftStore((s) => s.elevations);
  const selectedIds = useDraftStore((s) => s.selectedIds);
  const addElement = useDraftStore((s) => s.addElement);
  const patchElement = useDraftStore((s) => s.patchElement);
  const removeElements = useDraftStore((s) => s.removeElements);
  const toggleSelected = useDraftStore((s) => s.toggleSelected);
  const setSelected = useDraftStore((s) => s.setSelected);
  const clearSelection = useDraftStore((s) => s.clearSelection);

  const catalog = useCatalog();

  // Resize observer on the container
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: Math.max(400, r.width), height: Math.max(300, r.height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /**
   * Compute a {scale, x, y} transform that frames the visible elements (or a
   * sensible default 6m × 4m viewport when the drawing is empty) inside the
   * container with a 10% margin. Keeps the y-flip convention used by the
   * world layer (scaleY={-scale}).
   */
  const computeFitToView = useCallback(
    (
      elementsToFit: DrawingElementRow[],
      containerW: number,
      containerH: number
    ) => {
      const marginPx = 60;
      const drawable = {
        w: Math.max(200, containerW - marginPx * 2),
        h: Math.max(200, containerH - marginPx * 2),
      };

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of elementsToFit) {
        const ex = Number(el.x_mm);
        const ey = Number(el.y_mm);
        const ew = Number(el.width_mm ?? 0);
        const eh = Number(el.height_mm ?? 0);
        minX = Math.min(minX, ex);
        minY = Math.min(minY, ey);
        maxX = Math.max(maxX, ex + ew);
        maxY = Math.max(maxY, ey + eh);
      }
      if (!Number.isFinite(minX) || maxX - minX < 10 || maxY - minY < 10) {
        // Empty or degenerate: default 6m × 4m centered on origin.
        const defaultW = 6000;
        const defaultH = 4000;
        minX = -defaultW / 2;
        minY = -defaultH / 2;
        maxX = defaultW / 2;
        maxY = defaultH / 2;
      }
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const scale = Math.min(drawable.w / bboxW, drawable.h / bboxH, 2);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return {
        scale,
        // World → screen: screen.x = stageX + wx * scale. For cx to land at
        // the container center: stageX = containerW/2 - cx * scale.
        x: containerW / 2 - cx * scale,
        // With scaleY=-scale: screen.y = stageY - wy * scale. For cy to land
        // at the container center: stageY = containerH/2 + cy * scale.
        y: containerH / 2 + cy * scale,
      };
    },
    []
  );

  const fitToView = useCallback(() => {
    const visible = Object.values(elements).filter(
      (e) => e.view_type === currentView
    );
    const next = computeFitToView(visible, size.width, size.height);
    setStageState(next);
  }, [elements, currentView, size.width, size.height, computeFitToView]);

  // First render / drawing change → auto-fit once the container has a size.
  useEffect(() => {
    if (didInitialFitRef.current) return;
    if (size.width < 400 || size.height < 300) return;
    const next = computeFitToView([], size.width, size.height);
    setStageState(next);
    didInitialFitRef.current = true;
  }, [size.width, size.height, computeFitToView]);

  // When the current drawing changes, re-fit to the new content.
  useEffect(() => {
    if (!currentDrawing) return;
    didInitialFitRef.current = false; // allow another auto-fit
    if (size.width < 400 || size.height < 300) return;
    const visible = Object.values(elements).filter(
      (e) => e.view_type === currentView
    );
    const next = computeFitToView(visible, size.width, size.height);
    setStageState(next);
    didInitialFitRef.current = true;
    // We intentionally DON'T depend on `elements` here — auto-fit should
    // trigger only on drawing or view change, not every element mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDrawing?.id, currentView]);

  // Keyboard: Delete, Escape, arrow-nudge
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement | null)?.tagName === 'INPUT' ||
        (e.target as HTMLElement | null)?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (selectedIds.length === 0) {
        if (e.key === 'Escape') {
          setWallToolActive(false);
          setWallStart(null);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElements(selectedIds);
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -NUDGE_MM : e.key === 'ArrowRight' ? NUDGE_MM : 0;
        const dy = e.key === 'ArrowDown' ? -NUDGE_MM : e.key === 'ArrowUp' ? NUDGE_MM : 0;
        for (const id of selectedIds) {
          const el = elements[id];
          if (!el) continue;
          patchElement(id, {
            x_mm: Number(el.x_mm) + dx,
            y_mm: Number(el.y_mm) + dy,
          });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, elements, patchElement, removeElements, clearSelection]);

  // Filter visible elements by the current view + area + elevation.
  //
  // KEY DESIGN: Elevation is a DERIVED VIEW of the Plan, not a separate
  // canvas. When in elevation view, we take all plan-view cabinets from
  // the current area and project them as elevation renderings. This makes
  // Plan ↔ Elevation inherently linked — place a cabinet in Plan and it
  // automatically appears in Elevation at the correct height.
  //
  // Elevation-only elements (dimensions, tags, notes) are stored with
  // view_type='elevation' and render alongside the projected cabinets.
  const visibleElements = useMemo(() => {
    const out: DrawingElementRow[] = [];

    if (currentView === 'plan') {
      for (const el of Object.values(elements)) {
        if (el.view_type !== 'plan') continue;
        if (el.area_id && el.area_id !== currentAreaId) continue;
        out.push(el);
      }
    } else if (currentView === 'elevation') {
      // 1. Project plan cabinets into elevation coordinates
      const planCabinets = Object.values(elements).filter(
        (el) =>
          el.view_type === 'plan' &&
          el.element_type === 'cabinet' &&
          (!el.area_id || el.area_id === currentAreaId)
      );
      // Sort by plan X position so they stack left-to-right
      planCabinets.sort((a, b) => Number(a.x_mm) - Number(b.x_mm));

      let elevX = 0;
      for (const planEl of planCabinets) {
        const product = planEl.product_id ? catalog[planEl.product_id] : null;
        const family = product?.draft_family ?? 'base';
        const elevY = family === 'wall' ? inToMm(54) : 0;
        // Create a virtual elevation element (not persisted — derived on the fly)
        const projected: DrawingElementRow = {
          ...planEl,
          view_type: 'elevation' as string,
          x_mm: elevX,
          y_mm: elevY,
          rotation_deg: 0,
        };
        out.push(projected);
        elevX += Number(planEl.width_mm ?? 0);
      }

      // 2. Also include real elevation-only elements (dimensions, tags, notes)
      for (const el of Object.values(elements)) {
        if (el.view_type !== 'elevation') continue;
        if (el.element_type === 'cabinet') continue; // skip old duplicates
        if (el.elevation_id && el.elevation_id !== currentElevationId) continue;
        out.push(el);
      }
    }

    return out.sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  }, [elements, currentView, currentAreaId, currentElevationId, catalog]);

  // ── Mouse/wheel handlers ──────────────────────────────────────────────
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const oldScale = stageState.scale;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    // World point under the cursor BEFORE the zoom, accounting for y-flip.
    const worldBefore = {
      x: (pointer.x - stageState.x) / oldScale,
      y: (stageState.y - pointer.y) / oldScale,
    };
    const newScale =
      e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clamped = Math.max(0.02, Math.min(3, newScale));
    // Keep the world point under the cursor fixed in screen space.
    const newPos = {
      x: pointer.x - worldBefore.x * clamped,
      y: pointer.y + worldBefore.y * clamped,
    };
    setStageState({ scale: clamped, x: newPos.x, y: newPos.y });
  }

  function screenToWorld(screenX: number, screenY: number) {
    const s = stageStateRef.current; // always fresh, not closure-stale
    return {
      x: (screenX - s.x) / s.scale,
      y: (s.y - screenY) / s.scale,
    };
  }

  // ── Drop handler (drag-drop from CatalogPanel) ────────────────────────
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw || !currentDrawing) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.kind !== 'catalog_cabinet') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    // Smart snap: align to nearest wall / floor / AFF datum before insert.
    const snap = snapCabinetOnDrop(
      world.x,
      world.y,
      {
        family: payload.family,
        width_mm: payload.width_mm,
        depth_mm: payload.depth_mm,
      },
      Object.values(elements),
      currentView === 'plan' ? 'plan' : 'elevation'
    );

    const cabinetProps: CabinetProps = { type: 'cabinet' };
    const row: DrawingElementInsert = {
      id: crypto.randomUUID(),
      drawing_id: currentDrawing.id,
      area_id: currentAreaId,
      elevation_id: currentView === 'elevation' ? currentElevationId : null,
      view_type: currentView,
      element_type: 'cabinet',
      product_id: payload.product_id,
      tag: null,
      x_mm: snap.x_mm,
      y_mm: snap.y_mm,
      rotation_deg: snap.rotation_deg,
      width_mm: payload.width_mm,
      height_mm: payload.height_mm,
      depth_mm: payload.depth_mm,
      props: cabinetProps as unknown as DrawingElementRow['props'],
      z_index: 0,
    };
    addElement(row as DrawingElementRow);
    // Elevation representation is auto-derived from plan elements — no
    // separate elevation element needed. See visibleElements useMemo.
  }

  // ── Toolbar action handlers (Steps 7.6, 9, 10) ────────────────────────
  function handleAutoCountertopClick() {
    const selected = selectedIds.map((id) => elements[id]).filter(Boolean);
    if (selected.length === 0) {
      alert('Select at least one base/vanity cabinet first.');
      return;
    }
    const hasCabinet = selected.some((e) => e.element_type === 'cabinet');
    if (!hasCabinet) {
      alert('Selection must include at least one cabinet.');
      return;
    }
    setCountertopModalOpen(true);
  }

  function handleCreateCountertop(settings: {
    materialLabel: string;
    thicknessIn: number;
    edgeProfile: CountertopProps['edge_profile'];
    backsplash?: { present: boolean; height_in: number; material_label: string };
  }) {
    if (!currentDrawing) return;
    const selected = selectedIds
      .map((id) => elements[id])
      .filter(
        (e): e is DrawingElementRow =>
          Boolean(e) && e.element_type === 'cabinet' && e.view_type === 'plan'
      );
    const outlines = generateCountertopOutlines(selected);
    for (const outline of outlines) {
      const props = buildCountertopProps(
        outline,
        settings.materialLabel,
        settings.thicknessIn,
        settings.edgeProfile,
        settings.backsplash
      );
      const row: DrawingElementRow = {
        id: crypto.randomUUID(),
        drawing_id: currentDrawing.id,
        area_id: currentAreaId,
        elevation_id: null,
        view_type: 'plan',
        element_type: 'countertop',
        product_id: null,
        tag: null,
        x_mm: outline.origin.x,
        y_mm: outline.origin.y,
        rotation_deg: outline.rotation_deg,
        width_mm: outline.localWidth,
        height_mm: outline.localDepth,
        depth_mm: null,
        props: props as unknown as DrawingElementRow['props'],
        z_index: -5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addElement(row);
    }
  }

  function handleDimensionAllClick() {
    if (!currentDrawing) return;
    const plan = generateDimensions(Object.values(elements), {
      drawingId: currentDrawing.id,
      view: currentView,
      areaId: currentAreaId,
      elevationId: currentElevationId,
    });
    if (plan.toRemove.length > 0) removeElements(plan.toRemove);
    for (const dim of plan.dimensions) {
      addElement(dim as DrawingElementRow);
    }
  }

  function handleAutoTagClick() {
    if (!currentDrawing || currentDrawing.lock_tags) return;
    const area = areas.find((a) => a.id === currentAreaId) ?? null;
    const elevation = elevations.find((e) => e.id === currentElevationId) ?? null;
    if (!area || !elevation) {
      alert('Auto-tag requires an active elevation. Switch to Elevation view first.');
      return;
    }
    const plan = generateAutoTags(Object.values(elements), {
      area,
      elevation,
      lockTags: Boolean(currentDrawing.lock_tags),
    });
    for (const upd of plan.updates) {
      patchElement(upd.id, { tag: upd.tag });
    }
  }

  // ── Pan + click handlers ──────────────────────────────────────────────
  // Manual pan replaces Stage draggable to avoid the double-offset bug
  // (Stage.x + Layer.x both applied simultaneously). stageState is the
  // single source of truth for position; updated every mouse-move frame.

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // Only start a pan from empty Stage (not from elements)
    if (e.target !== e.target.getStage()) return;
    if (wallToolActive) return; // wall tool uses click-click, not drag
    setIsPanning(true);
    panStartRef.current = {
      mx: e.evt.clientX,
      my: e.evt.clientY,
      sx: stageState.x,
      sy: stageState.y,
    };
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>): void {
    // Pan continuation (smooth — every frame)
    if (isPanning && panStartRef.current) {
      const dx = e.evt.clientX - panStartRef.current.mx;
      const dy = e.evt.clientY - panStartRef.current.my;
      setStageState((s) => ({
        ...s,
        x: panStartRef.current!.sx + dx,
        y: panStartRef.current!.sy + dy,
      }));
      return; // don't fire wall cursor update during pan
    }
    // Wall tool cursor tracking
    if (wallToolActive && wallStart) {
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setWallCursor(screenToWorld(pointer.x, pointer.y));
    }
  }

  function handleStageMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return; // don't fire click after a pan
    }
    // Treat as click (mouseup without prior pan)
    if (e.target === e.target.getStage()) {
      if (wallToolActive) {
        handleWallClick();
      } else {
        clearSelection();
      }
    }
  }

  function handleWallClick() {
    const stage = stageRef.current;
    if (!stage || !currentDrawing) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const world = screenToWorld(pointer.x, pointer.y);
    if (!wallStart) {
      setWallStart(world);
      setWallCursor(world);
      return;
    }
    // Second click — create the wall element.
    const dx = world.x - wallStart.x;
    const dy = world.y - wallStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 50) {
      // Ignore accidental < 50mm clicks.
      setWallStart(null);
      setWallCursor(null);
      return;
    }
    const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const wallProps: WallProps = { type: 'wall', thickness_mm: inToMm(4.5) };
    const row: DrawingElementRow = {
      id: crypto.randomUUID(),
      drawing_id: currentDrawing.id,
      area_id: currentAreaId,
      elevation_id: null,
      view_type: 'plan',
      element_type: 'wall',
      product_id: null,
      tag: null,
      x_mm: wallStart.x,
      y_mm: wallStart.y,
      rotation_deg: rotationDeg,
      width_mm: length,
      height_mm: inToMm(4.5),
      depth_mm: null,
      props: wallProps as unknown as DrawingElementRow['props'],
      z_index: -10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addElement(row);
    // Keep wall tool active — user can draw the next wall immediately.
    setWallStart(null);
    setWallCursor(null);
  }

  // ── Grid ───────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const baseStep = currentView === 'plan' ? inToMm(1) : inToMm(0.5);
    const step = gridStep(baseStep, stageState.scale);
    // Compute world bounds visible in the viewport.
    const worldLeft = -stageState.x / stageState.scale;
    const worldRight = (size.width - stageState.x) / stageState.scale;
    const worldBottom = (stageState.y - size.height) / stageState.scale;
    const worldTop = stageState.y / stageState.scale;
    const lines: Array<{ points: [number, number, number, number]; strong: boolean }> = [];
    const startX = Math.floor(worldLeft / step) * step;
    const endX = Math.ceil(worldRight / step) * step;
    const startY = Math.floor(worldBottom / step) * step;
    const endY = Math.ceil(worldTop / step) * step;
    // Hard cap for safety (never > 600 lines total)
    const maxLines = 600;
    let count = 0;
    for (let x = startX; x <= endX && count < maxLines; x += step) {
      const strong = Math.abs(x % GRID_STRONG_STEP) < 0.5;
      lines.push({ points: [x, worldBottom, x, worldTop], strong });
      count++;
    }
    for (let y = startY; y <= endY && count < maxLines; y += step) {
      const strong = Math.abs(y % GRID_STRONG_STEP) < 0.5;
      lines.push({ points: [worldLeft, y, worldRight, y], strong });
      count++;
    }
    return lines;
  }, [stageState, size, currentView]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-full overflow-hidden rounded-2xl glass-white text-slate-700 ${
        isPanning ? 'cursor-grabbing' : wallToolActive ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
    >
      {/* Canvas toolbar */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setWallToolActive((x) => !x);
            setWallStart(null);
            setWallCursor(null);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            wallToolActive
              ? 'bg-indigo-600 text-white shadow-md'
              : 'glass-white border border-slate-200/60 text-slate-700 hover:bg-white'
          }`}
        >
          {wallToolActive ? 'Drawing wall…' : 'Draw wall'}
        </button>
        <button
          type="button"
          onClick={handleAutoCountertopClick}
          disabled={currentView !== 'plan'}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium glass-white border border-slate-200/60 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          title="Generate a countertop from the selected cabinets"
        >
          <Square className="h-3.5 w-3.5" />
          Auto Countertop
        </button>
        <button
          type="button"
          onClick={handleDimensionAllClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium glass-white border border-slate-200/60 text-slate-700 hover:bg-white"
          title="Generate dimension chains for the current view"
        >
          <Ruler className="h-3.5 w-3.5" />
          Dimension All
        </button>
        <button
          type="button"
          onClick={handleAutoTagClick}
          disabled={currentView !== 'elevation' || Boolean(currentDrawing?.lock_tags)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium glass-white border border-slate-200/60 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          title="Assign position tags to cabinets in this elevation"
        >
          <TagIcon className="h-3.5 w-3.5" />
          Auto-tag
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium glass-white border border-slate-200/60 text-slate-700 hover:bg-white"
          title="Fit visible elements to the viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Fit
        </button>
      </div>

      {/* Wall-tool hint banner */}
      {wallToolActive && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-indigo-600/90 text-white text-xs shadow-lg">
          {wallStart
            ? 'Click to set the wall end — press Esc to cancel'
            : 'Click to set the wall start point'}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer
          listening={false}
          x={stageState.x}
          y={stageState.y}
          scaleX={stageState.scale}
          scaleY={-stageState.scale}
        >
          {gridLines.map((g, i) => (
            <Line
              key={i}
              points={g.points}
              stroke={g.strong ? GRID_STRONG : GRID_COLOR}
              strokeWidth={1 / stageState.scale}
              listening={false}
            />
          ))}
        </Layer>

        {/* Wall-tool preview line + live length label */}
        {wallToolActive && wallStart && wallCursor && (
          <Layer
            listening={false}
            x={stageState.x}
            y={stageState.y}
            scaleX={stageState.scale}
            scaleY={-stageState.scale}
          >
            <Line
              points={[wallStart.x, wallStart.y, wallCursor.x, wallCursor.y]}
              stroke="#6366f1"
              strokeWidth={inToMm(4.5)}
              opacity={0.4}
              lineCap="round"
            />
            {/* Live length label at the midpoint, unflipped for readability */}
            {(() => {
              const midX = (wallStart.x + wallCursor.x) / 2;
              const midY = (wallStart.y + wallCursor.y) / 2;
              const lengthMm = Math.hypot(
                wallCursor.x - wallStart.x,
                wallCursor.y - wallStart.y
              );
              const label = formatInchesFractional(lengthMm);
              return (
                <Group x={midX} y={midY} scaleY={-1}>
                  <Text
                    text={label}
                    fontSize={40 / stageState.scale}
                    fontStyle="bold"
                    fill="#4338ca"
                    offsetX={(label.length * (40 / stageState.scale)) / 4}
                    offsetY={(60 / stageState.scale)}
                  />
                </Group>
              );
            })()}
          </Layer>
        )}

        <Layer
          x={stageState.x}
          y={stageState.y}
          scaleX={stageState.scale}
          scaleY={-stageState.scale}
        >
          {visibleElements.map((el) => {
            if (el.element_type === 'wall') {
              return (
                <WallNode
                  key={el.id}
                  element={el}
                  selected={selectedIds.includes(el.id)}
                  onSelect={(multi) => toggleSelected(el.id, multi)}
                />
              );
            }
            if (el.element_type === 'cabinet') {
              const product = el.product_id ? catalog[el.product_id] : null;
              return (
                <CabinetNode
                  key={el.id}
                  element={el}
                  product={product ?? null}
                  view={currentView}
                  selected={selectedIds.includes(el.id)}
                  showTag={Boolean(currentDrawing?.show_position_tags)}
                  onSelect={(multi) => {
                    if (multi) toggleSelected(el.id, true);
                    else setSelected([el.id]);
                  }}
                  onDragEndWorld={(x, y) => patchElement(el.id, { x_mm: x, y_mm: y })}
                />
              );
            }
            if (el.element_type === 'countertop') {
              return (
                <CountertopNode
                  key={el.id}
                  element={el}
                  view={currentView}
                  selected={selectedIds.includes(el.id)}
                  onSelect={(multi) => toggleSelected(el.id, multi)}
                />
              );
            }
            if (el.element_type === 'dimension') {
              return (
                <DimensionNode
                  key={el.id}
                  element={el}
                  lang={(currentDrawing?.export_language as 'en' | 'es') ?? 'en'}
                  selected={selectedIds.includes(el.id)}
                  onSelect={(multi) => toggleSelected(el.id, multi)}
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>

      <CountertopModal
        isOpen={countertopModalOpen}
        onClose={() => setCountertopModalOpen(false)}
        selectedCount={selectedIds.length}
        onCreate={handleCreateCountertop}
      />
    </div>
  );
}

// ── Element renderers ──────────────────────────────────────────────────────

function WallNode({
  element,
  selected,
  onSelect,
}: {
  element: DrawingElementRow;
  selected: boolean;
  onSelect: (multi: boolean) => void;
}) {
  const length = Number(element.width_mm ?? 0);
  const thickness = Number(element.height_mm ?? inToMm(4.5));
  return (
    <Group
      x={Number(element.x_mm)}
      y={Number(element.y_mm)}
      rotation={Number(element.rotation_deg ?? 0)}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey);
      }}
    >
      <Rect
        x={0}
        y={-thickness / 2}
        width={length}
        height={thickness}
        fill={WALL_STROKE}
        opacity={0.8}
      />
      {selected && (
        <Rect
          x={-5}
          y={-thickness / 2 - 5}
          width={length + 10}
          height={thickness + 10}
          stroke={SELECTION_STROKE}
          strokeWidth={3}
          dash={[12, 6]}
          fillEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

function CabinetNode({
  element,
  product,
  view,
  selected,
  showTag,
  onSelect,
  onDragEndWorld,
}: {
  element: DrawingElementRow;
  product: import('../types').ProductsCatalogRow | null;
  view: import('../types').ViewType;
  selected: boolean;
  showTag: boolean;
  onSelect: (multi: boolean) => void;
  onDragEndWorld: (x: number, y: number) => void;
}) {
  const result = useMemo(() => {
    if (!product) return null;
    try {
      return getBlockSvg(product, view, { lang: 'en', showDiamond: true, showSpecString: true });
    } catch (err) {
      console.warn('[CabinetNode] render failed', product.sku, err);
      return null;
    }
  }, [product, view]);

  if (!product) {
    return (
      <Group
        x={Number(element.x_mm)}
        y={Number(element.y_mm)}
        draggable
        onDragEnd={(e) => onDragEndWorld(e.target.x(), e.target.y())}
        onClick={(e) => { e.cancelBubble = true; onSelect(e.evt.shiftKey); }}
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'move'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ''; }}
      >
        <Rect x={0} y={0}
          width={Number(element.width_mm ?? 600)}
          height={Number(element.height_mm ?? 760)}
          stroke="#ef4444" strokeWidth={3} dash={[8, 4]} />
      </Group>
    );
  }

  const width = result?.widthMm ?? Number(element.width_mm ?? 0);
  const height = result?.heightMm ?? Number(element.height_mm ?? 0);

  return (
    <Group
      x={Number(element.x_mm)}
      y={Number(element.y_mm)}
      rotation={Number(element.rotation_deg ?? 0)}
      draggable
      onDragEnd={(e) => onDragEndWorld(e.target.x(), e.target.y())}
      onClick={(e) => { e.cancelBubble = true; onSelect(e.evt.shiftKey); }}
      onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'move'; }}
      onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ''; }}
    >
      {result?.primitives.map((prim, idx) => renderPrimitive(prim, idx))}
      {/* Position tag (K-A1) — shown when auto-tagged and toggle is on */}
      {showTag && element.tag && (
        <Group x={width / 2} y={-30} scaleY={-1}>
          <Rect
            x={-40}
            y={-16}
            width={80}
            height={24}
            fill="white"
            stroke={SELECTION_STROKE}
            strokeWidth={1}
            cornerRadius={4}
          />
          <Text
            x={-36}
            y={-12}
            text={element.tag}
            fontSize={16}
            fontStyle="bold"
            fill={SELECTION_STROKE}
          />
        </Group>
      )}
      {selected && (
        <Rect
          x={-10}
          y={-10}
          width={width + 20}
          height={height + 20}
          stroke={SELECTION_STROKE}
          strokeWidth={4}
          dash={[14, 8]}
          fillEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Countertop + Dimension Konva nodes ────────────────────────────────────

function CountertopNode({
  element,
  view,
  selected,
  onSelect,
}: {
  element: DrawingElementRow;
  view: import('../types').ViewType;
  selected: boolean;
  onSelect: (multi: boolean) => void;
}) {
  const result = useMemo(() => {
    try {
      const props = element.props as unknown as CountertopProps;
      if (props?.type !== 'countertop') return null;
      return renderCountertop(props, element, view);
    } catch (err) {
      console.warn('[CountertopNode] render failed', err);
      return null;
    }
  }, [element, view]);

  if (!result) return null;

  return (
    <Group
      x={Number(element.x_mm)}
      y={Number(element.y_mm)}
      rotation={Number(element.rotation_deg ?? 0)}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey);
      }}
    >
      {/* Base fill polygon (first polygon primitive) */}
      {result.primitives.map((p, idx) => {
        if (p.kind === 'polygon') {
          return (
            <Line
              key={`fill-${idx}`}
              points={[...p.points]}
              closed
              fill={COUNTERTOP_FILL}
              stroke={COUNTERTOP_STROKE}
              strokeWidth={p.strokeWidth ?? 2}
            />
          );
        }
        if (p.kind === 'rect') {
          return (
            <Rect
              key={`rect-${idx}`}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={COUNTERTOP_FILL}
              stroke={COUNTERTOP_STROKE}
              strokeWidth={p.strokeWidth ?? 2}
              opacity={p.fillOpacity ?? 1}
            />
          );
        }
        if (p.kind === 'line') {
          return (
            <Line
              key={`line-${idx}`}
              points={[...p.points]}
              stroke={COUNTERTOP_STROKE}
              strokeWidth={p.strokeWidth ?? 1}
              dash={p.dash}
            />
          );
        }
        if (p.kind === 'text') {
          return (
            <Group key={`text-${idx}`} x={p.x} y={p.y} scaleY={-1}>
              <Text
                text={p.text}
                fontSize={p.fontSize ?? 24}
                fontStyle={p.bold ? 'bold' : undefined}
                fill={COUNTERTOP_STROKE}
                align={p.align ?? 'left'}
                offsetX={p.align === 'center' ? (p.text.length * (p.fontSize ?? 24)) / 4 : 0}
              />
            </Group>
          );
        }
        return null;
      })}
      {selected && result.widthMm > 0 && result.heightMm > 0 && (
        <Rect
          x={-10}
          y={-10}
          width={result.widthMm + 20}
          height={result.heightMm + 20}
          stroke={SELECTION_STROKE}
          strokeWidth={4}
          dash={[14, 8]}
          fillEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

function DimensionNode({
  element,
  lang,
  selected,
  onSelect,
}: {
  element: DrawingElementRow;
  lang: 'en' | 'es';
  selected: boolean;
  onSelect: (multi: boolean) => void;
}) {
  const result = useMemo(() => {
    try {
      const props = element.props as unknown as DimensionProps;
      if (props?.type !== 'dimension') return null;
      return renderDimension(props, lang);
    } catch (err) {
      console.warn('[DimensionNode] render failed', err);
      return null;
    }
  }, [element, lang]);

  if (!result) return null;

  return (
    <Group
      x={Number(element.x_mm)}
      y={Number(element.y_mm)}
      rotation={Number(element.rotation_deg ?? 0)}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey);
      }}
    >
      {result.primitives.map((p, idx) => {
        if (p.kind === 'line') {
          return (
            <Line
              key={`dim-line-${idx}`}
              points={[...p.points]}
              stroke={DIMENSION_STROKE}
              strokeWidth={p.strokeWidth ?? 2}
              dash={p.dash}
            />
          );
        }
        if (p.kind === 'text') {
          return (
            <Group key={`dim-text-${idx}`} x={p.x} y={p.y} scaleY={-1}>
              <Text
                text={p.text}
                fontSize={p.fontSize ?? 36}
                fontStyle={p.bold ? 'bold' : undefined}
                fill={DIMENSION_STROKE}
                align={p.align ?? 'left'}
                offsetX={p.align === 'center' ? (p.text.length * (p.fontSize ?? 36)) / 4 : 0}
              />
            </Group>
          );
        }
        return null;
      })}
      {selected && (
        <Rect
          x={-20}
          y={-20}
          width={result.widthMm + 40}
          height={result.heightMm + 40}
          stroke={SELECTION_STROKE}
          strokeWidth={2}
          dash={[8, 4]}
          fillEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Primitive → Konva renderer ─────────────────────────────────────────────

function renderPrimitive(p: BlockPrimitive, key: number): React.ReactNode {
  if (p.kind === 'rect') {
    return (
      <Rect
        key={key}
        x={p.x}
        y={p.y}
        width={p.width}
        height={p.height}
        stroke={ELEMENT_STROKE}
        strokeWidth={p.strokeWidth ?? 2}
        dash={p.dash}
        fillEnabled={false}
      />
    );
  }
  if (p.kind === 'line') {
    return (
      <Line
        key={key}
        points={[...p.points]}
        stroke={ELEMENT_STROKE}
        strokeWidth={p.strokeWidth ?? 1}
        dash={p.dash}
        lineCap="square"
      />
    );
  }
  if (p.kind === 'polygon') {
    return (
      <Line
        key={key}
        points={[...p.points]}
        stroke={ELEMENT_STROKE}
        strokeWidth={p.strokeWidth ?? 1}
        closed={p.closed ?? false}
        fillEnabled={false}
      />
    );
  }
  if (p.kind === 'text') {
    // Re-flip Y so text reads correctly under a scaleY(-1) parent.
    return (
      <Group key={key} x={p.x} y={p.y} scaleY={-1}>
        <Text
          text={p.text}
          fontSize={p.fontSize ?? 24}
          fontStyle={p.bold ? 'bold' : undefined}
          fill={ELEMENT_TEXT}
          align={p.align ?? 'left'}
          offsetX={p.align === 'center' ? (p.text.length * (p.fontSize ?? 24)) / 4 : 0}
        />
      </Group>
    );
  }
  if (p.kind === 'diamond') {
    const r = p.radius;
    return (
      <Group key={key}>
        <Line
          points={[p.cx, p.cy + r, p.cx + r, p.cy, p.cx, p.cy - r, p.cx - r, p.cy]}
          stroke={ELEMENT_STROKE}
          strokeWidth={2}
          closed
          fill="white"
        />
        {p.connectTo && (
          <Line
            points={[p.cx, p.cy - r, p.connectTo.x, p.connectTo.y]}
            stroke={ELEMENT_STROKE}
            strokeWidth={1}
          />
        )}
        <Group x={p.cx} y={p.cy} scaleY={-1}>
          <Text
            text={p.code}
            fontSize={r * 0.9}
            fontStyle="bold"
            fill={ELEMENT_TEXT}
            align="center"
            offsetX={(p.code.length * r * 0.9) / 4}
            offsetY={-r * 0.4}
          />
        </Group>
      </Group>
    );
  }
  return null;
}
