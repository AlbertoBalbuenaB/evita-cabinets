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

/**
 * Trim loss consumed by the edgebander per edged side of a piece.
 *
 * The machine requires ~3cm of leader material at the entry and another ~3cm
 * at the exit of each pass (glue-up + flush-trim cycle). Every piece-side
 * flagged with cubrecanto therefore consumes its own length PLUS ~6cm of
 * physical waste. Applied per side (not per piece) so that pieces with
 * multiple edged sides scale correctly.
 *
 * Optimizer-only: ft² pricing relies on `product.box_edgeband` /
 * `product.doors_fronts_edgeband` as declared meters, so it is not injected
 * there to avoid double-charging if those declared values already include
 * machine waste.
 */
export const EB_TRIM_LOSS_PER_SIDE_M = 0.06;

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

/** Optional plId + name lookup for legacy `ebPriceBySlot` fallback. When a
 *  piece falls to the fallback branch (cabinetId not present in
 *  `ebCabinetMap`) and `ebSlotMeta[slot]` is provided, the cost still goes
 *  into `perEdgebandType` under the provided plId — otherwise those meters
 *  are invisible to any downstream consumer that iterates `perEdgebandType`
 *  (e.g. the BOM table). Use the owning snapshot's `ebConfig` /
 *  `ebSlotToPriceListId` to populate. */
export interface EbSlotMeta {
  a?: { plId: string; name: string };
  b?: { plId: string; name: string };
  c?: { plId: string; name: string };
}

/**
 * @param pieces          The tagged Pieza[] fed to the optimizer.
 * @param ebPriceBySlot   Price per linear meter for each slot (legacy fallback).
 * @param ebCabinetMap    Per-cabinet edgeband price lookup (new). When provided,
 *                        takes priority over `ebPriceBySlot` for each piece.
 * @param ebSlotMeta      Slot → plId+name lookup used when a piece falls to the
 *                        legacy fallback, so those meters still aggregate into
 *                        `perEdgebandType` for BOM display.
 */
export function computeEdgebandCost(
  pieces: Pieza[],
  ebPriceBySlot: Record<'a' | 'b' | 'c', number>,
  ebCabinetMap?: EbCabinetMap,
  ebSlotMeta?: EbSlotMeta,
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

      const meters = (lengthMm / 1000 + EB_TRIM_LOSS_PER_SIDE_M) * p.cantidad;
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
        // Promote the fallback pieces into `perEdgebandType` when caller
        // supplies the slot → plId+name lookup, so the BOM doesn't silently
        // drop them.
        const meta = ebSlotMeta?.[slot];
        if (meta) {
          ebPlId = meta.plId;
          ebName = meta.name;
        }
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

/**
 * Edgeband cost computed as whole rolls per edgeband type.
 *
 * Each distinct edgeband (grouped by `plId` in `perEdgebandType`) is
 * rounded up to whole rolls of `rollLengthMeters` (default 150m) and
 * priced at `pricePerMeter × rollLengthMeters`. Mirrors the rolls-based
 * accounting used in ft² pricing (edgeband is sold by the roll; you pay
 * for whole rolls even if you don't use them completely).
 *
 * Expected to be the `edgebandCost` input to `computeQuotationTotals` in
 * optimizer mode so that Materials Cost and the BOM footer reconcile to
 * the same number. The raw `meters × price` total is still available via
 * `computeEdgebandCost(...).totalCost` for historical / diagnostic use.
 *
 * Important: each edgeband type is rounded INDEPENDENTLY. 4 types of
 * 100 meters each = 4 rolls, not 2 (= 400m / 150 rounded up).
 */
export function computeEdgebandRollsCost(
  pieces: Pieza[],
  ebPriceBySlot: Record<'a' | 'b' | 'c', number>,
  ebCabinetMap?: EbCabinetMap,
  ebSlotMeta?: EbSlotMeta,
  rollLengthMeters: number = 150,
): number {
  const { perEdgebandType } = computeEdgebandCost(
    pieces,
    ebPriceBySlot,
    ebCabinetMap,
    ebSlotMeta,
  );
  let total = 0;
  for (const eb of Object.values(perEdgebandType)) {
    if (eb.meters <= 0) continue;
    // Skip "Not Apply" edgebands so they don't contribute cost.
    if (eb.name.toLowerCase().includes('not apply')) continue;
    const pricePerMeter = eb.cost / eb.meters;
    const rollsNeeded = Math.ceil(eb.meters / rollLengthMeters);
    total += rollsNeeded * pricePerMeter * rollLengthMeters;
  }
  return total;
}
