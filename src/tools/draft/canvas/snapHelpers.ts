/**
 * Draft Tool — smart snap helpers (Step 8).
 *
 * Pure geometry functions used when an element is dropped on the canvas
 * or moved by the user. Two main rules:
 *
 *   1. Plan view: if a cabinet is dropped within 12" of a wall, snap its
 *      back face to the wall's interior line, rotate to match the wall
 *      angle, and chain flush to any neighbour cabinets on the same wall
 *      within 2".
 *
 *   2. Elevation view: snap to known datums
 *        - base / tall cabinets → floor (y = 0)
 *        - wall cabinets         → 54" AFF (1371.6 mm)
 *        - crown (460 w/ height > counter) → top of tallest wall cabinet
 *
 * All geometry is in millimeters. Nothing in this file reads from Zustand
 * or touches React — the caller passes in all relevant elements and
 * receives patched coordinates back.
 */

import { inToMm } from '../utils/format';
import type { DrawingElementRow, DrawingFamily } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────
const SNAP_DISTANCE_TO_WALL = inToMm(12); // 12"
const CHAIN_GAP_THRESHOLD = inToMm(2); // 2"
const WALL_AFF_MM = inToMm(54); // 54" above finished floor

// ── Types ──────────────────────────────────────────────────────────────────
export interface SnapResult {
  x_mm: number;
  y_mm: number;
  rotation_deg: number;
  /** True if a snap rule fired. The caller can use this for a small visual
   *  flash feedback ("snapped!"). */
  snapped: boolean;
}

interface WallGeom {
  element: DrawingElementRow;
  /** Start point (world coords). */
  start: { x: number; y: number };
  /** End point (world coords). */
  end: { x: number; y: number };
  /** Unit vector along the wall. */
  dir: { x: number; y: number };
  /** Inward-pointing normal (toward which cabinets go). */
  normal: { x: number; y: number };
  /** Wall angle in degrees. */
  angleDeg: number;
  /** Wall thickness in mm. */
  thickness: number;
}

// ── Wall geometry extraction ───────────────────────────────────────────────
function toWallGeom(wall: DrawingElementRow): WallGeom | null {
  const length = Number(wall.width_mm ?? 0);
  if (length <= 0) return null;
  const thickness = Number(wall.height_mm ?? inToMm(4.5));
  const angleDeg = Number(wall.rotation_deg ?? 0);
  const angleRad = (angleDeg * Math.PI) / 180;
  const start = { x: Number(wall.x_mm), y: Number(wall.y_mm) };
  const end = {
    x: start.x + Math.cos(angleRad) * length,
    y: start.y + Math.sin(angleRad) * length,
  };
  const dir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  // Normal is dir rotated 90° CCW. By convention cabinets live on the +normal
  // side (above the wall in local coords).
  const normal = { x: -dir.y, y: dir.x };
  return { element: wall, start, end, dir, normal, angleDeg, thickness };
}

// ── Distance from point to segment ─────────────────────────────────────────
function distanceToWall(
  point: { x: number; y: number },
  w: WallGeom
): { distance: number; projected: { x: number; y: number }; t: number } {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const d = Math.hypot(point.x - w.start.x, point.y - w.start.y);
    return { distance: d, projected: w.start, t: 0 };
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - w.start.x) * dx + (point.y - w.start.y) * dy) / lenSq)
  );
  const projected = {
    x: w.start.x + t * dx,
    y: w.start.y + t * dy,
  };
  const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
  return { distance, projected, t };
}

// ── Plan-view snap: align to wall + chain flush ────────────────────────────
export function snapCabinetOnDrop(
  candidateX: number,
  candidateY: number,
  cabinet: {
    family: DrawingFamily;
    width_mm: number;
    depth_mm: number;
  },
  allElements: DrawingElementRow[],
  view: 'plan' | 'elevation'
): SnapResult {
  if (view === 'plan') {
    // Find walls sorted by distance from the drop point
    const walls = allElements
      .filter((e) => e.element_type === 'wall' && e.view_type === 'plan')
      .map(toWallGeom)
      .filter((w): w is WallGeom => w !== null);

    let best: { wall: WallGeom; info: ReturnType<typeof distanceToWall> } | null = null;
    for (const w of walls) {
      const info = distanceToWall({ x: candidateX, y: candidateY }, w);
      if (info.distance < SNAP_DISTANCE_TO_WALL) {
        if (!best || info.distance < best.info.distance) {
          best = { wall: w, info };
        }
      }
    }

    if (best) {
      // Snap: place the cabinet so that its back face (y=0 in local coords)
      // sits on the wall's interior line. In world coords, that means the
      // cabinet origin (bottom-left) is at the projected point minus
      // thickness/2 along the wall normal.
      const { wall, info } = best;
      const insideX = info.projected.x + wall.normal.x * (wall.thickness / 2);
      const insideY = info.projected.y + wall.normal.y * (wall.thickness / 2);

      // Chain-flush: look for cabinets already on the same wall within 2"
      // along the wall direction, and offset the X origin to start at their
      // right edge.
      const sameWallCabs = allElements.filter(
        (e) =>
          e.element_type === 'cabinet' &&
          e.view_type === 'plan' &&
          Math.abs(Number(e.rotation_deg ?? 0) - wall.angleDeg) < 1
      );
      const candAlong =
        (insideX - wall.start.x) * wall.dir.x + (insideY - wall.start.y) * wall.dir.y;
      let chainOffset = 0;
      for (const neighbour of sameWallCabs) {
        const neighAlong =
          (Number(neighbour.x_mm) - wall.start.x) * wall.dir.x +
          (Number(neighbour.y_mm) - wall.start.y) * wall.dir.y;
        const neighWidth = Number(neighbour.width_mm ?? 0);
        const rightEdge = neighAlong + neighWidth;
        if (
          rightEdge >= candAlong - cabinet.width_mm &&
          rightEdge <= candAlong + CHAIN_GAP_THRESHOLD
        ) {
          // Chain: start where the neighbour's right edge is
          chainOffset = Math.max(chainOffset, rightEdge - candAlong);
        }
      }

      const finalX = insideX + wall.dir.x * chainOffset;
      const finalY = insideY + wall.dir.y * chainOffset;
      return {
        x_mm: finalX,
        y_mm: finalY,
        rotation_deg: wall.angleDeg,
        snapped: true,
      };
    }

    // No wall in range — no snap
    return { x_mm: candidateX, y_mm: candidateY, rotation_deg: 0, snapped: false };
  }

  // Elevation-view snaps: floor / wall AFF / crown
  if (cabinet.family === 'base' || cabinet.family === 'tall') {
    return { x_mm: candidateX, y_mm: 0, rotation_deg: 0, snapped: true };
  }
  if (cabinet.family === 'wall') {
    return { x_mm: candidateX, y_mm: WALL_AFF_MM, rotation_deg: 0, snapped: true };
  }
  // accessory / closet → honor drop point
  return { x_mm: candidateX, y_mm: Math.max(0, candidateY), rotation_deg: 0, snapped: false };
}
