/**
 * Compose the per-area "cabinets subtotal" used by the MXN/USD PDF exports
 * when a quotation is printed in optimizer (precise) mode.
 *
 * This is the bridge between the Breakdown/optimizer pricing path and the
 * existing ft²-based quotation PDF flow. The PDF functions already iterate
 * over `areas` and sum `cabinet.subtotal` per area; this helper produces an
 * EQUIVALENT number per area but sourced from the optimizer run, so we can
 * swap it in without rewriting the PDF rollup logic.
 *
 * What it returns, per area:
 *   - boardsCost    : optimizer board material, allocated to this area by
 *                     the same m²-proportional rule already used in the
 *                     Breakdown tab (`allocateBoardCostsByArea`).
 *   - edgebandCost  : sum of `snapshot.edgebandCostByCabinet[cab.id]` for
 *                     every COVERED cabinet in this area.
 *   - coveredExtras : for every COVERED cabinet, its non-material extras
 *                     (`subtotal − Σ MATERIAL_FIELDS`). This mirrors the
 *                     branch in `computeOptimizerQuotationTotal` and keeps
 *                     hardware / labor / accessories / door profile /
 *                     back-panel / interior-finish costs intact.
 *   - fallback      : for every NOT-covered cabinet, its full ft²
 *                     `cabinet.subtotal` (mixed-mode safety net).
 *   - cabinetsSubtotal : boardsCost + edgebandCost + coveredExtras + fallback
 *                        — the drop-in replacement for `Σ cabinet.subtotal`.
 *
 * IMPORTANT:
 *   - Numbers are pre-`area.quantity`, matching how the PDFs currently sum
 *     `cabinet.subtotal` before multiplying by `qty` in the area breakdown.
 *   - Items, countertops and closet items are NOT touched — they always
 *     come from the ft² snapshot, in both modes.
 *   - If an area has no covered cabinets and no fallback cabinets, it's
 *     simply omitted from the map, so callers should `??` back to the ft²
 *     sum (which will naturally be zero in that case anyway).
 */

import type { AreaWithChildren } from '../../pricing/computeQuotationTotalsSqft';
import type { OptimizationResult, StockSize } from '../types';
import type { OptimizerRunSnapshot } from './types';
import {
  MATERIAL_FIELDS,
  cabinetMaterialCost,
} from './computeOptimizerQuotationTotal';

// Re-export so consumers don't need to reach into the total helper.
export { MATERIAL_FIELDS, cabinetMaterialCost };

export interface OptimizerAreaSubtotal {
  boardsCost: number;
  edgebandCost: number;
  coveredExtras: number;
  fallback: number;
  cabinetsSubtotal: number;
}

/**
 * Pure function: given an optimizer result and the stocks that priced it,
 * attribute board cost to each area by the m²-proportional rule.
 *
 * This is the extracted version of the `perAreaRows` memo in
 * `QuotationOptimizerTab.tsx` (which previously inlined the same aggregation).
 * Keeping it here makes the Breakdown tab, the PDF exporters, and any
 * future diagnostics share a single source of truth.
 *
 * Returns `areaId → { m2, cost, boards }` where:
 *   - m2     : total piece m² placed in this area (denominator for cost)
 *   - cost   : allocated board material cost in MXN
 *   - boards : fractional board count (a single board shared across areas
 *              is split by m² fraction — matches the Breakdown display).
 */
export function allocateBoardCostsByArea(
  result: OptimizationResult,
  stocks: StockSize[],
): Record<string, { m2: number; cost: number; boards: number }> {
  const stockByName = new Map(stocks.map((s) => [s.nombre, s]));
  const out: Record<string, { m2: number; cost: number; boards: number }> = {};

  for (const board of result.boards) {
    if (board.placed.length === 0) continue;

    // Prefer the snapshot stock cost (authoritative at build time); fall
    // back to the engine's stockInfo.costo for remnants / legacy runs.
    const boardCost =
      stockByName.get(board.stockInfo.nombre)?.costo ?? board.stockInfo.costo;

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

    for (const [areaId, m2] of Object.entries(perAreaM2)) {
      const f = m2 / totalM2;
      const entry = (out[areaId] ??= { m2: 0, cost: 0, boards: 0 });
      entry.m2 += m2;
      entry.cost += boardCost * f;
      entry.boards += f;
    }
  }

  return out;
}

export interface OptimizerAreaSubtotalsInput {
  snapshot: OptimizerRunSnapshot;
  result: OptimizationResult;
  areasData: AreaWithChildren[];
  cabinetsCovered: Set<string>;
}

/**
 * Compose per-area "cabinets subtotal" in optimizer mode. See file-level
 * docstring for the exact formula. Pure function — safe to call from any
 * context (PDF exporter, tests, dev tools).
 *
 * Areas with zero cabinets (items-only or countertops-only) are omitted
 * from the map so the PDF fallback to `Σ cabinet.subtotal` (= 0) still
 * produces identical output.
 */
export function computeOptimizerAreaSubtotals(
  args: OptimizerAreaSubtotalsInput,
): Record<string, OptimizerAreaSubtotal> {
  const { snapshot, result, areasData, cabinetsCovered } = args;

  // Board cost attributed to each area by m² share.
  const boardsByArea = allocateBoardCostsByArea(result, snapshot.stocks);

  const ebByCabinet = snapshot.edgebandCostByCabinet ?? {};

  const out: Record<string, OptimizerAreaSubtotal> = {};

  for (const area of areasData) {
    if (area.cabinets.length === 0) continue;

    let coveredExtras = 0;
    let edgebandCost = 0;
    let fallback = 0;

    for (const cab of area.cabinets) {
      const subtotal =
        typeof cab.subtotal === 'number' && Number.isFinite(cab.subtotal)
          ? cab.subtotal
          : 0;

      if (cabinetsCovered.has(cab.id)) {
        const extras =
          subtotal -
          cabinetMaterialCost(cab as unknown as Record<string, unknown>);
        coveredExtras += extras;
        const eb = ebByCabinet[cab.id];
        if (typeof eb === 'number' && Number.isFinite(eb)) {
          edgebandCost += eb;
        }
      } else {
        fallback += subtotal;
      }
    }

    const boardsCost = boardsByArea[area.id]?.cost ?? 0;
    const cabinetsSubtotal =
      boardsCost + edgebandCost + coveredExtras + fallback;

    // Only emit areas that have either optimizer contribution or fallback
    // cabinets — pure items/countertops/closets areas are left to the
    // PDF's built-in ft² path (they won't be in the map at all).
    if (cabinetsSubtotal !== 0 || boardsCost !== 0 || edgebandCost !== 0) {
      out[area.id] = {
        boardsCost,
        edgebandCost,
        coveredExtras,
        fallback,
        cabinetsSubtotal,
      };
    }
  }

  return out;
}

/**
 * Compute the share of `optimizerMaterialsCost` (boards + edgeband) that is
 * attributable to areas with `applies_tariff === true`. Used by
 * `computeOptimizerQuotationTotal` to mirror the ft² tariff rule
 * ("tariff applies only to materials coming from tariffable areas")
 * proportionally rather than the old all-or-nothing heuristic.
 *
 * Rule:
 *   - **Boards**: allocated by piece m² share per area (same rule as the
 *     PDF exporter and the Breakdown tab). Sum over tariffable areas.
 *   - **Edgeband**: resolved per-cabinet (each piece belongs to exactly
 *     one cabinet, which belongs to exactly one area). Sum the per-cabinet
 *     edgeband cost for every cabinet whose area is tariffable.
 *
 * This is a pure function; callers supply both the optimizer run payload
 * and the per-cabinet edgeband map. Stored runs use
 * `snapshot.edgebandCostByCabinet`; live recomputations (e.g. BreakdownBOM)
 * pass `computeEdgebandCost(...).perCabinet`.
 */
export function computeOptimizerTariffableMaterialsCost(args: {
  result: OptimizationResult;
  snapshot: OptimizerRunSnapshot;
  areasData: AreaWithChildren[];
  edgebandByCabinet: Record<string, number>;
}): number {
  const { result, snapshot, areasData, edgebandByCabinet } = args;

  // ── Boards: m²-proportional allocation per area, sum over tariffable ──
  const byArea = allocateBoardCostsByArea(result, snapshot.stocks);
  let tariffableBoards = 0;
  for (const area of areasData) {
    if (area.applies_tariff === true) {
      tariffableBoards += byArea[area.id]?.cost ?? 0;
    }
  }

  // ── Edgeband: per-cabinet, bucket by area.applies_tariff ──
  const cabinetIsTariffable = new Map<string, boolean>();
  for (const area of areasData) {
    const tariffable = area.applies_tariff === true;
    for (const cab of area.cabinets) {
      cabinetIsTariffable.set(cab.id, tariffable);
    }
  }
  let tariffableEdgeband = 0;
  for (const [cabId, cost] of Object.entries(edgebandByCabinet)) {
    if (
      cabinetIsTariffable.get(cabId) === true &&
      typeof cost === 'number' &&
      Number.isFinite(cost)
    ) {
      tariffableEdgeband += cost;
    }
  }

  return tariffableBoards + tariffableEdgeband;
}
