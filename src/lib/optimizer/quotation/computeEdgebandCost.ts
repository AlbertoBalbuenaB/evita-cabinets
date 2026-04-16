/**
 * Compute total edge banding cost for an optimizer setup.
 *
 * The optimizer engine does not track edge banding meters — it only bin-packs
 * boards. This pure function walks the tagged Pieza[] and sums the perimeter
 * of every cubrecanto-flagged side, multiplied by the price per linear meter.
 *
 * Supports two pricing modes:
 *   1. Per-cabinet (new): each piece is priced using its cabinet's actual
 *      edgeband assignment via `ebCabinetMap[cabinetId][slotCode]`. This
 *      handles N distinct edgeband types across a quotation.
 *   2. Global slots (legacy fallback): 3 fixed prices (a/b/c) used when
 *      `ebCabinetMap` is not provided (backward compat with old snapshots).
 *
 * Called AFTER `buildOptimizerSetupFromQuotation` and AFTER
 * `runOptimization` — but it only depends on pieces + eb prices, so it can
 * be recomputed at any time without re-running the optimizer.
 */

import type { Pieza, EbCabinetMap } from '../types';

export interface EdgebandCostResult {
  /** Total edge banding cost in the same currency as the eb slot prices. */
  totalCost: number;
  /** Total linear meters of edge banding across all pieces. */
  totalMeters: number;
  /** Breakdown by cabinetId (for per-cabinet cost substitution). */
  perCabinet: Record<string, number>;
  /** Breakdown by slot (for legacy reporting). */
  perSlot: Record<'a' | 'b' | 'c', { meters: number; cost: number }>;
  /**
   * Breakdown by actual edgeband price_list id (for accurate BOM display).
   * Only populated when `ebCabinetMap` is provided.
   */
  perEdgebandType: Record<string, { name: string; plId: string; meters: number; cost: number }>;
}

/**
 * @param pieces          The tagged Pieza[] fed to the optimizer.
 * @param ebPriceBySlot   Price per linear meter for each slot (legacy fallback).
 * @param ebCabinetMap    Per-cabinet edgeband price lookup (new). When provided,
 *                        takes priority over `ebPriceBySlot` for each piece.
 */
export function computeEdgebandCost(
  pieces: Pieza[],
  ebPriceBySlot: Record<'a' | 'b' | 'c', number>,
  ebCabinetMap?: EbCabinetMap,
): EdgebandCostResult {
  const perCabinet: Record<string, number> = {};
  const perSlot: Record<'a' | 'b' | 'c', { meters: number; cost: number }> = {
    a: { meters: 0, cost: 0 },
    b: { meters: 0, cost: 0 },
    c: { meters: 0, cost: 0 },
  };
  const perEdgebandType: Record<string, { name: string; plId: string; meters: number; cost: number }> = {};
  let totalCost = 0;
  let totalMeters = 0;

  for (const p of pieces) {
    const cb = p.cubrecanto;
    if (!cb) continue;

    // Each side contributes its length (mm) × cantidad, converted to meters.
    // cb.sup/inf/izq/der are numeric slot codes: 0=none, 1=box, 2=doors, 3+=future roles.
    const sides: Array<{ slotCode: number; lengthMm: number }> = [
      { slotCode: cb.sup, lengthMm: p.ancho },
      { slotCode: cb.inf, lengthMm: p.ancho },
      { slotCode: cb.izq, lengthMm: p.alto  },
      { slotCode: cb.der, lengthMm: p.alto  },
    ];

    // Resolve per-cabinet edgeband info (if available)
    const cabEb = ebCabinetMap && p.cabinetId ? ebCabinetMap[p.cabinetId] : undefined;

    for (const { slotCode, lengthMm } of sides) {
      if (slotCode <= 0) continue;

      const meters = (lengthMm / 1000) * p.cantidad;
      let price: number;
      let ebPlId: string | null = null;
      let ebName: string | null = null;

      // Per-cabinet pricing (new): use actual cabinet's edgeband price
      if (cabEb && cabEb[slotCode]) {
        price = cabEb[slotCode].pricePerMeter;
        ebPlId = cabEb[slotCode].plId;
        ebName = cabEb[slotCode].name;
      } else {
        // Legacy fallback: global slot pricing
        const slot: 'a' | 'b' | 'c' | null =
          slotCode === 1 ? 'a' :
          slotCode === 2 ? 'b' :
          slotCode === 3 ? 'c' : null;
        if (!slot) continue;
        price = ebPriceBySlot[slot] ?? 0;
      }

      const cost = meters * price;

      // Legacy slot tracking (for backward compat)
      const slot: 'a' | 'b' | 'c' | null =
        slotCode === 1 ? 'a' :
        slotCode === 2 ? 'b' :
        slotCode === 3 ? 'c' : null;
      if (slot) {
        perSlot[slot].meters += meters;
        perSlot[slot].cost   += cost;
      }

      // Per-type tracking (for BOM display)
      if (ebPlId && ebName) {
        const existing = perEdgebandType[ebPlId];
        if (existing) {
          existing.meters += meters;
          existing.cost   += cost;
        } else {
          perEdgebandType[ebPlId] = { name: ebName, plId: ebPlId, meters, cost };
        }
      }

      totalMeters += meters;
      totalCost   += cost;

      if (p.cabinetId) {
        perCabinet[p.cabinetId] = (perCabinet[p.cabinetId] ?? 0) + cost;
      }
    }
  }

  return { totalCost, totalMeters, perCabinet, perSlot, perEdgebandType };
}
