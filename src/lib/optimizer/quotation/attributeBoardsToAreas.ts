/**
 * Attribute optimizer-produced boards to project_areas by piece m² fraction.
 *
 * The optimizer engine groups by (material × thickness) and packs pieces into
 * boards without awareness of which project area each piece came from.
 * Sheets are often shared between areas (e.g. Kitchen and Closet pieces on
 * the same Evita Plus 18mm board). To display a per-area breakdown of
 * boards used and cost, we attribute each board proportionally to the m² of
 * pieces each area contributed.
 *
 * Formula (per board):
 *   area_m2      = Σ placed_pieces where piece.areaId === X of (w × h / 1e6)
 *   total_m2     = Σ all placed pieces of (w × h / 1e6)   (== board.areaUsed)
 *   area_fraction = area_m2 / total_m2
 *   area_cost    = area_fraction × board.stockInfo.costo
 *   area_boards  = area_fraction  (fractional — sums to board count)
 *
 * Totals aggregate across all boards in the OptimizationResult.
 */

import type { OptimizationResult } from '../types';

export interface AreaAttribution {
  /** m² of pieces contributed by this area across all boards. */
  m2: number;
  /** Allocated material cost (same currency as stockInfo.costo). */
  cost: number;
  /** Fractional board count (e.g. 2.5 = 2 full + half of one shared). */
  boards: number;
}

export type BoardsByArea = Record<string /* areaId */, AreaAttribution>;

export function attributeBoardsToAreas(result: OptimizationResult): BoardsByArea {
  const out: BoardsByArea = {};

  for (const board of result.boards) {
    if (board.placed.length === 0) continue;

    // Sum m² per area on this board.
    const perAreaM2: Record<string, number> = {};
    let totalM2 = 0;
    for (const pp of board.placed) {
      const areaId = pp.piece.areaId;
      if (!areaId) continue;
      const m2 = (pp.w * pp.h) / 1_000_000;
      perAreaM2[areaId] = (perAreaM2[areaId] ?? 0) + m2;
      totalM2 += m2;
    }

    if (totalM2 <= 0) continue;

    // Allocate board cost proportionally.
    const boardCost = board.stockInfo.costo;
    for (const [areaId, m2] of Object.entries(perAreaM2)) {
      const fraction = m2 / totalM2;
      const bucket = (out[areaId] ??= { m2: 0, cost: 0, boards: 0 });
      bucket.m2     += m2;
      bucket.cost   += boardCost * fraction;
      bucket.boards += fraction;
    }
  }

  return out;
}
