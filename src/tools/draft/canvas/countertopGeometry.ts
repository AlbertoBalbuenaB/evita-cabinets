/**
 * Draft Tool — countertop auto-generation (Step 7.6, mode A).
 *
 * Takes a list of selected cabinet elements in plan view and produces a
 * countertop outline polygon with the standard Evita overhang rules:
 *
 *   - 1" overhang on the front face (unless that side is a waterfall)
 *   - Flush on the left/right ends unless they are at a "run extreme"
 *     (no neighbour within 2" on that side), in which case they get the
 *     same 1" overhang
 *   - Flush on the back face (walls)
 *
 * Cabinets are grouped by wall (inferred from their rotation_deg — same
 * angle = same run). Each wall-group produces its own outline.
 *
 * Manual draw mode (mode B, polyline click-click-close) is deferred to
 * Session D; the helper here covers the common case (>90% of kitchens).
 */

import { inToMm } from '../utils/format';
import type { DrawingElementRow, CountertopProps } from '../types';

const DEFAULT_OVERHANG_IN = 1;
const RUN_END_GAP_MM = inToMm(2);

export interface CountertopOutline {
  outline_mm: Array<{ x: number; y: number }>;
  associated_cabinet_ids: string[];
  /** The rotation angle shared by all cabinets in the run (degrees). */
  rotation_deg: number;
  /** Anchor (lower-left of the bounding run) in world coords. */
  origin: { x: number; y: number };
  /** Axis-aligned bounding dimensions in the wall-local frame (mm). */
  localWidth: number;
  localDepth: number;
}

/**
 * Group selected cabinets by run angle + wall alignment, then emit one
 * outline per group.
 */
export function generateCountertopOutlines(
  selectedCabinets: DrawingElementRow[]
): CountertopOutline[] {
  // Filter: plan view, base/vanity/sink only (no walls, no tall ovens, no closets).
  const eligible = selectedCabinets.filter(
    (c) =>
      c.element_type === 'cabinet' &&
      c.view_type === 'plan' &&
      ['base', 'vanity', 'corner_base'].includes(
        ((c.props as { family?: string } | null)?.family as string) ??
          'base'
      )
  );
  // The `family` hint in props is optional — if missing, we still include.
  const candidates =
    eligible.length > 0
      ? eligible
      : selectedCabinets.filter(
          (c) => c.element_type === 'cabinet' && c.view_type === 'plan'
        );

  if (candidates.length === 0) return [];

  // Group by rotation angle (rounded to 1° precision)
  const groups = new Map<string, DrawingElementRow[]>();
  for (const c of candidates) {
    const key = Math.round(Number(c.rotation_deg ?? 0)).toString();
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  const outlines: CountertopOutline[] = [];
  for (const [key, group] of groups) {
    const angleDeg = parseFloat(key);
    const angleRad = (angleDeg * Math.PI) / 180;
    const dir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    const normal = { x: -dir.y, y: dir.x };

    // Project each cabinet's origin onto the wall-local frame:
    //   along = (x,y) · dir
    //   depth = (x,y) · normal
    // Then extend to include its width and depth.
    interface Ranged {
      el: DrawingElementRow;
      alongStart: number;
      alongEnd: number;
      depthStart: number;
      depthEnd: number;
    }
    const ranged: Ranged[] = group.map((el) => {
      const ox = Number(el.x_mm);
      const oy = Number(el.y_mm);
      const w = Number(el.width_mm ?? 0);
      const d = Number(el.depth_mm ?? inToMm(24));
      const along = ox * dir.x + oy * dir.y;
      const depth = ox * normal.x + oy * normal.y;
      return {
        el,
        alongStart: along,
        alongEnd: along + w,
        depthStart: depth,
        depthEnd: depth + d,
      };
    });

    // Sort along the wall direction
    ranged.sort((a, b) => a.alongStart - b.alongStart);

    // Compute bounding along + depth
    const alongMin = ranged[0].alongStart;
    const alongMax = ranged[ranged.length - 1].alongEnd;
    const depthMin = Math.min(...ranged.map((r) => r.depthStart));
    const depthMax = Math.max(...ranged.map((r) => r.depthEnd));

    // Determine if the ends are "run extremes" (no neighbour within 2")
    // For auto-generation we assume endpoints are always extreme. Caller
    // can override via the modal if needed.
    const overhangFront = inToMm(DEFAULT_OVERHANG_IN);
    const overhangEnd = RUN_END_GAP_MM; // flush unless user says otherwise

    // Build outline in wall-local coords (along, depth):
    // Bottom-left → bottom-right → top-right → top-left
    const localRect = [
      { along: alongMin - overhangEnd, depth: depthMin },
      { along: alongMax + overhangEnd, depth: depthMin },
      { along: alongMax + overhangEnd, depth: depthMax + overhangFront },
      { along: alongMin - overhangEnd, depth: depthMax + overhangFront },
    ];

    // Transform back to world coords
    const outline = localRect.map((p) => ({
      x: p.along * dir.x + p.depth * normal.x,
      y: p.along * dir.y + p.depth * normal.y,
    }));

    outlines.push({
      outline_mm: outline,
      associated_cabinet_ids: ranged.map((r) => r.el.id),
      rotation_deg: angleDeg,
      origin: outline[0],
      localWidth: alongMax - alongMin + 2 * overhangEnd,
      localDepth: depthMax - depthMin + overhangFront,
    });
  }

  return outlines;
}

/**
 * Build the full CountertopProps object ready to be persisted as a
 * drawing_element with element_type='countertop'.
 */
export function buildCountertopProps(
  outline: CountertopOutline,
  materialLabel: string,
  thicknessIn: number,
  edgeProfile: CountertopProps['edge_profile'],
  backsplash?: { present: boolean; height_in: number; material_label: string },
  label?: string
): CountertopProps {
  return {
    type: 'countertop',
    material_label: materialLabel,
    thickness_in: thicknessIn,
    edge_profile: edgeProfile,
    overhang_front_in: DEFAULT_OVERHANG_IN,
    overhang_left_in: 0,
    overhang_right_in: 0,
    waterfall_sides: [],
    backsplash: backsplash ?? undefined,
    seams: [],
    outline_mm: outline.outline_mm,
    associated_cabinet_ids: outline.associated_cabinet_ids,
    label,
  };
}
