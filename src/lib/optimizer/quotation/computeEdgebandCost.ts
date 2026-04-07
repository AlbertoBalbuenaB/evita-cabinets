/**
 * Compute total edge banding cost for an optimizer setup (Option β).
 *
 * The optimizer engine does not track edge banding meters — it only bin-packs
 * boards. This pure function walks the tagged Pieza[] and sums the perimeter
 * of every cubrecanto-flagged side, multiplied by the price per linear meter
 * of the matching slot (a/b/c).
 *
 * Called AFTER `buildOptimizerSetupFromQuotation` and AFTER
 * `runOptimization` — but it only depends on pieces + eb prices, so it can
 * be recomputed at any time without re-running the optimizer.
 */

import type { Pieza } from '../types';

export interface EdgebandCostResult {
  /** Total edge banding cost in the same currency as the eb slot prices. */
  totalCost: number;
  /** Total linear meters of edge banding across all pieces. */
  totalMeters: number;
  /** Breakdown by cabinetId (for per-cabinet cost substitution). */
  perCabinet: Record<string, number>;
  /** Breakdown by slot (for reporting). */
  perSlot: Record<'a' | 'b' | 'c', { meters: number; cost: number }>;
}

/**
 * @param pieces          The tagged Pieza[] fed to the optimizer.
 * @param ebPriceBySlot   Price per linear meter for each slot (0 if unused).
 */
export function computeEdgebandCost(
  pieces: Pieza[],
  ebPriceBySlot: Record<'a' | 'b' | 'c', number>,
): EdgebandCostResult {
  const perCabinet: Record<string, number> = {};
  const perSlot: Record<'a' | 'b' | 'c', { meters: number; cost: number }> = {
    a: { meters: 0, cost: 0 },
    b: { meters: 0, cost: 0 },
    c: { meters: 0, cost: 0 },
  };
  let totalCost = 0;
  let totalMeters = 0;

  for (const p of pieces) {
    const cb = p.cubrecanto;
    if (!cb) continue;

    // Each side contributes its length (mm) × cantidad, converted to meters.
    // cb.sup/inf/izq/der are numeric slot codes: 0=none, 1=a, 2=b, 3=c.
    const sides: Array<{ slotCode: number; lengthMm: number }> = [
      { slotCode: cb.sup, lengthMm: p.ancho },
      { slotCode: cb.inf, lengthMm: p.ancho },
      { slotCode: cb.izq, lengthMm: p.alto  },
      { slotCode: cb.der, lengthMm: p.alto  },
    ];

    for (const { slotCode, lengthMm } of sides) {
      if (slotCode <= 0) continue;

      const slot: 'a' | 'b' | 'c' | null =
        slotCode === 1 ? 'a' :
        slotCode === 2 ? 'b' :
        slotCode === 3 ? 'c' : null;
      if (!slot) continue;

      const meters = (lengthMm / 1000) * p.cantidad;
      const price  = ebPriceBySlot[slot] ?? 0;
      const cost   = meters * price;

      perSlot[slot].meters += meters;
      perSlot[slot].cost   += cost;
      totalMeters += meters;
      totalCost   += cost;

      if (p.cabinetId) {
        perCabinet[p.cabinetId] = (perCabinet[p.cabinetId] ?? 0) + cost;
      }
    }
  }

  return { totalCost, totalMeters, perCabinet, perSlot };
}
