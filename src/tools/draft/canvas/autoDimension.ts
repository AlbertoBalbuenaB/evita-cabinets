/**
 * Draft Tool — auto-dimensioning helpers (Step 9).
 *
 * Pure helpers that take the current elements of a drawing (one area /
 * elevation at a time) and produce dimension elements. Dimensions persist
 * their underlying value (`value_mm`) and the element IDs they anchor to
 * — *never* a pre-formatted string. The renderer chooses EN fractional
 * inches or ES centimeters at paint time via `drawings.export_language`.
 *
 * Phase 1 generates:
 *   - Plan view, per wall: a horizontal chain of cabinet widths and an
 *     overall wall length dimension 6" (152 mm) in front of the wall.
 *   - Elevation view: a horizontal chain of cabinet widths at the top of
 *     each cabinet and a vertical datum chain
 *     (toe kick 4.5" → base 31.5" → counter thickness → wall gap 18" → wall cab
 *      → crown) 6" to the left of the leftmost cabinet.
 *
 * This file contains no rendering — it only emits `DrawingElementInsert`
 * objects. The caller (DraftCanvas toolbar handler) passes each through
 * `addElement()`.
 */

import { inToMm } from '../utils/format';
import type {
  DrawingElementRow,
  DrawingElementInsert,
  DimensionProps,
  ViewType,
} from '../types';

const OFFSET_MM = inToMm(6);
const DEFAULT_TOE_KICK_MM = inToMm(4.5);
const DEFAULT_BASE_HEIGHT_MM = inToMm(31.5);
const DEFAULT_COUNTER_THK_MM = inToMm(1.5);
const DEFAULT_WALL_GAP_MM = inToMm(18); // space between counter and wall cab

export interface DimensionPlan {
  /** Dimensions that should be upserted into the store. */
  dimensions: DrawingElementInsert[];
  /** IDs of dimensions that already existed on the same anchors and
   *  should be removed before inserting the new set. */
  toRemove: string[];
}

/**
 * Build dimension elements for the given area (plan view) or elevation
 * (elevation view). The caller passes the whole element set + the current
 * view context.
 */
export function generateDimensions(
  elements: DrawingElementRow[],
  context: {
    drawingId: string;
    view: ViewType;
    areaId: string | null;
    elevationId: string | null;
  }
): DimensionPlan {
  const { view, areaId, elevationId, drawingId } = context;
  const existing: DrawingElementRow[] = [];
  const visible: DrawingElementRow[] = [];
  for (const el of elements) {
    if (el.view_type !== view) continue;
    if (view === 'plan' && el.area_id && el.area_id !== areaId) continue;
    if (view === 'elevation' && el.elevation_id && el.elevation_id !== elevationId)
      continue;
    if (el.element_type === 'dimension') existing.push(el);
    else visible.push(el);
  }

  const out: DrawingElementInsert[] = [];
  const toRemove = existing.map((e) => e.id);

  if (view === 'plan') {
    out.push(...dimensionsForPlanView(visible, { drawingId, areaId }));
  } else {
    out.push(...dimensionsForElevationView(visible, { drawingId, elevationId, areaId }));
  }

  return { dimensions: out, toRemove };
}

// ── Plan view ──────────────────────────────────────────────────────────────
function dimensionsForPlanView(
  visible: DrawingElementRow[],
  ctx: { drawingId: string; areaId: string | null }
): DrawingElementInsert[] {
  const walls = visible.filter((e) => e.element_type === 'wall');
  const out: DrawingElementInsert[] = [];

  for (const wall of walls) {
    const angleDeg = Number(wall.rotation_deg ?? 0);
    const angleRad = (angleDeg * Math.PI) / 180;
    const dir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    const normal = { x: -dir.y, y: dir.x };

    // Find cabinets on this wall (same rotation ± 1°)
    const cabs = visible
      .filter(
        (e) =>
          e.element_type === 'cabinet' &&
          Math.abs(Number(e.rotation_deg ?? 0) - angleDeg) < 1
      )
      .map((e) => {
        const along =
          Number(e.x_mm) * dir.x + Number(e.y_mm) * dir.y;
        return { el: e, along };
      })
      .sort((a, b) => a.along - b.along);

    if (cabs.length === 0) continue;

    // Individual width dimensions, chained
    for (const { el } of cabs) {
      const widthMm = Number(el.width_mm ?? 0);
      if (widthMm <= 0) continue;
      const originX = Number(el.x_mm) + normal.x * OFFSET_MM;
      const originY = Number(el.y_mm) + normal.y * OFFSET_MM;
      out.push(
        makeDimensionInsert({
          drawingId: ctx.drawingId,
          areaId: ctx.areaId,
          elevationId: null,
          viewType: 'plan',
          originX,
          originY,
          widthMm,
          rotationDeg: angleDeg,
          anchorIds: [el.id],
          orientation: 'horizontal',
        })
      );
    }

    // Overall wall chain (sum of widths)
    const totalWidth = cabs.reduce(
      (acc, { el }) => acc + Number(el.width_mm ?? 0),
      0
    );
    const firstAlong = cabs[0].along;
    const originX =
      Number(wall.x_mm) + dir.x * (firstAlong - Number(wall.x_mm) * dir.x) + normal.x * OFFSET_MM * 2;
    const originY =
      Number(wall.y_mm) + dir.y * (firstAlong - Number(wall.y_mm) * dir.y) + normal.y * OFFSET_MM * 2;
    out.push(
      makeDimensionInsert({
        drawingId: ctx.drawingId,
        areaId: ctx.areaId,
        elevationId: null,
        viewType: 'plan',
        originX,
        originY,
        widthMm: totalWidth,
        rotationDeg: angleDeg,
        anchorIds: cabs.map((c) => c.el.id),
        orientation: 'horizontal',
      })
    );
  }

  return out;
}

// ── Elevation view ─────────────────────────────────────────────────────────
function dimensionsForElevationView(
  visible: DrawingElementRow[],
  ctx: { drawingId: string; elevationId: string | null; areaId: string | null }
): DrawingElementInsert[] {
  const cabs = visible
    .filter((e) => e.element_type === 'cabinet')
    .sort((a, b) => Number(a.x_mm) - Number(b.x_mm));

  if (cabs.length === 0) return [];

  const out: DrawingElementInsert[] = [];

  // Horizontal chain at top
  const topY =
    Math.max(
      ...cabs.map((c) => Number(c.y_mm) + Number(c.height_mm ?? 0))
    ) + OFFSET_MM;
  for (const cab of cabs) {
    const widthMm = Number(cab.width_mm ?? 0);
    if (widthMm <= 0) continue;
    out.push(
      makeDimensionInsert({
        drawingId: ctx.drawingId,
        areaId: ctx.areaId,
        elevationId: ctx.elevationId,
        viewType: 'elevation',
        originX: Number(cab.x_mm),
        originY: topY,
        widthMm,
        rotationDeg: 0,
        anchorIds: [cab.id],
        orientation: 'horizontal',
      })
    );
  }

  // Vertical datum chain on the left
  const leftX = Math.min(...cabs.map((c) => Number(c.x_mm))) - OFFSET_MM * 2;
  const datums: Array<{ label: string; value: number }> = [
    { label: 'toe kick', value: DEFAULT_TOE_KICK_MM },
    { label: 'base cabinet', value: DEFAULT_BASE_HEIGHT_MM },
    { label: 'counter', value: DEFAULT_COUNTER_THK_MM },
    { label: 'gap', value: DEFAULT_WALL_GAP_MM },
  ];

  let cursorY = 0;
  for (const d of datums) {
    out.push(
      makeDimensionInsert({
        drawingId: ctx.drawingId,
        areaId: ctx.areaId,
        elevationId: ctx.elevationId,
        viewType: 'elevation',
        originX: leftX,
        originY: cursorY,
        widthMm: d.value,
        rotationDeg: 90,
        anchorIds: [],
        orientation: 'vertical',
      })
    );
    cursorY += d.value;
  }

  return out;
}

// ── Factory ────────────────────────────────────────────────────────────────
interface MakeDimArgs {
  drawingId: string;
  areaId: string | null;
  elevationId: string | null;
  viewType: ViewType;
  originX: number;
  originY: number;
  widthMm: number;
  rotationDeg: number;
  anchorIds: string[];
  orientation: 'horizontal' | 'vertical';
}

function makeDimensionInsert(args: MakeDimArgs): DrawingElementInsert {
  const props: DimensionProps = {
    type: 'dimension',
    value_mm: args.widthMm,
    orientation: args.orientation,
    anchor_element_ids: args.anchorIds,
    offset_mm: OFFSET_MM,
  };
  return {
    id: crypto.randomUUID(),
    drawing_id: args.drawingId,
    area_id: args.areaId,
    elevation_id: args.elevationId,
    view_type: args.viewType,
    element_type: 'dimension',
    product_id: null,
    tag: null,
    x_mm: args.originX,
    y_mm: args.originY,
    rotation_deg: args.rotationDeg,
    width_mm: args.widthMm,
    height_mm: null,
    depth_mm: null,
    props: props as unknown as DrawingElementInsert['props'],
    z_index: 100, // dimensions on top
  };
}
