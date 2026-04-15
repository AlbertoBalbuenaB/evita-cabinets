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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useDraftStore } from '../store/useDraftStore';
import { useCatalog } from '../lib/useCatalog';
import type {
  DrawingElementRow,
  DrawingElementInsert,
  DragPayload,
  WallProps,
  CabinetProps,
} from '../types';
import { DRAG_MIME } from '../types';
import {
  BlockPrimitive,
  getBlockSvg,
} from '../svg/blockRenderer';
import { inToMm } from '../utils/format';

const GRID_COLOR = 'rgba(99, 102, 241, 0.10)';
const GRID_STRONG = 'rgba(99, 102, 241, 0.20)';
const SELECTION_STROKE = '#6366f1';
const WALL_STROKE = '#334155';
const NUDGE_MM = 3.175; // 1/8"

export function DraftCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stageState, setStageState] = useState({
    scale: 0.4, // mm → px; 0.4 ≈ 10mm per 4px
    x: 200,
    y: 400,
  });

  // Wall tool state (click-click)
  const [wallToolActive, setWallToolActive] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);

  // Store slices
  const currentDrawing = useDraftStore((s) => s.currentDrawing);
  const currentView = useDraftStore((s) => s.currentView);
  const currentAreaId = useDraftStore((s) => s.currentAreaId);
  const currentElevationId = useDraftStore((s) => s.currentElevationId);
  const elements = useDraftStore((s) => s.elements);
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

  // Filter visible elements by the current view + area + elevation
  const visibleElements = useMemo(() => {
    const out: DrawingElementRow[] = [];
    for (const el of Object.values(elements)) {
      if (el.view_type !== currentView) continue;
      if (currentView === 'plan') {
        if (el.area_id && el.area_id !== currentAreaId) continue;
      } else if (currentView === 'elevation') {
        if (el.elevation_id && el.elevation_id !== currentElevationId) continue;
      }
      out.push(el);
    }
    return out.sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  }, [elements, currentView, currentAreaId, currentElevationId]);

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
    return {
      x: (screenX - stageState.x) / stageState.scale,
      y: (stageState.y - screenY) / stageState.scale,
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
      x_mm: world.x,
      y_mm: world.y,
      rotation_deg: 0,
      width_mm: payload.width_mm,
      height_mm: payload.height_mm,
      depth_mm: payload.depth_mm,
      props: cabinetProps as unknown as DrawingElementRow['props'],
      z_index: 0,
    };
    addElement(row as DrawingElementRow);
  }

  // ── Stage click (empty area → clear selection) ────────────────────────
  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      if (wallToolActive) {
        handleWallClick(e);
      } else {
        clearSelection();
      }
    }
  }

  function handleWallClick(_e: Konva.KonvaEventObject<MouseEvent>) {
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
    setWallStart(null);
    setWallCursor(null);
  }

  function handleStageMouseMove(): void {
    if (!wallToolActive || !wallStart) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    setWallCursor(screenToWorld(pointer.x, pointer.y));
  }

  // ── Grid ───────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const stepSmall = currentView === 'plan' ? inToMm(1) : inToMm(0.5);
    const stepLarge = inToMm(12); // 12" accent
    // Compute world bounds visible in the stage.
    const worldLeft = -stageState.x / stageState.scale;
    const worldRight = (size.width - stageState.x) / stageState.scale;
    const worldBottom = (stageState.y - size.height) / stageState.scale;
    const worldTop = stageState.y / stageState.scale;
    const lines: Array<{ points: [number, number, number, number]; strong: boolean }> = [];
    // Cap total lines for performance
    const startX = Math.floor(worldLeft / stepSmall) * stepSmall;
    const endX = Math.ceil(worldRight / stepSmall) * stepSmall;
    const startY = Math.floor(worldBottom / stepSmall) * stepSmall;
    const endY = Math.ceil(worldTop / stepSmall) * stepSmall;
    const stepCount = Math.max(
      (endX - startX) / stepSmall,
      (endY - startY) / stepSmall
    );
    // If zoomed way out, skip the small grid entirely
    const drawSmall = stepCount < 400;
    for (let x = startX; x <= endX; x += stepSmall) {
      const strong = Math.abs(x % stepLarge) < 0.01;
      if (!strong && !drawSmall) continue;
      lines.push({ points: [x, worldBottom, x, worldTop], strong });
    }
    for (let y = startY; y <= endY; y += stepSmall) {
      const strong = Math.abs(y % stepLarge) < 0.01;
      if (!strong && !drawSmall) continue;
      lines.push({ points: [worldLeft, y, worldRight, y], strong });
    }
    return lines;
  }, [stageState, size, currentView]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden rounded-2xl glass-white text-slate-700"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
    >
      {/* Wall-tool toggle floating button */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
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
      </div>

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={handleStageClick}
        onMouseMove={handleStageMouseMove}
        x={0}
        y={0}
        draggable={!wallToolActive}
        onDragEnd={(e) => {
          setStageState((s) => ({ ...s, x: e.target.x(), y: e.target.y() }));
        }}
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

        {/* Wall-tool preview line */}
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
                  onSelect={(multi) => {
                    if (multi) toggleSelected(el.id, true);
                    else setSelected([el.id]);
                  }}
                  onDragEndWorld={(x, y) => patchElement(el.id, { x_mm: x, y_mm: y })}
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>
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
  onSelect,
  onDragEndWorld,
}: {
  element: DrawingElementRow;
  product: import('../types').ProductsCatalogRow | null;
  view: import('../types').ViewType;
  selected: boolean;
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
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(e.evt.shiftKey);
        }}
      >
        <Rect
          x={0}
          y={0}
          width={Number(element.width_mm ?? 600)}
          height={Number(element.height_mm ?? 760)}
          stroke="#ef4444"
          strokeWidth={3}
          dash={[8, 4]}
        />
      </Group>
    );
  }

  const width = result?.widthMm ?? Number(element.width_mm ?? 0);
  const height = result?.heightMm ?? Number(element.height_mm ?? 0);

  return (
    <Group
      x={Number(element.x_mm)}
      y={Number(element.y_mm)}
      draggable
      onDragEnd={(e) => {
        onDragEndWorld(e.target.x(), e.target.y());
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey);
      }}
    >
      {result?.primitives.map((prim, idx) => renderPrimitive(prim, idx))}
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
        stroke="currentColor"
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
        stroke="currentColor"
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
        stroke="currentColor"
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
          fill="currentColor"
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
          stroke="currentColor"
          strokeWidth={2}
          closed
          fill="white"
        />
        {p.connectTo && (
          <Line
            points={[p.cx, p.cy - r, p.connectTo.x, p.connectTo.y]}
            stroke="currentColor"
            strokeWidth={1}
          />
        )}
        <Group x={p.cx} y={p.cy} scaleY={-1}>
          <Text
            text={p.code}
            fontSize={r * 0.9}
            fontStyle="bold"
            fill="currentColor"
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
