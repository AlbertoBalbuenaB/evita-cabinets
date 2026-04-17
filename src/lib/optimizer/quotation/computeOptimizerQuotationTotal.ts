/**
 * Compose the optimizer-mode quotation total.
 *
 * This is the parallel of `computeQuotationTotalsSqft` for the optimizer
 * pricing path. It takes the same multiplier inputs and the same areas data,
 * but SUBSTITUTES the cabinet material subtotals with the optimizer-derived
 * numbers for cabinets that were successfully packed. Cabinets that fell
 * back to ft² (mixed mode, D2) contribute their full original `cabinet.subtotal`.
 *
 * What gets substituted (per plan §3 / P7):
 *   - box_material_cost
 *   - box_edgeband_cost
 *   - doors_material_cost
 *   - doors_edgeband_cost
 *
 * What is preserved from the ft² cabinet snapshot:
 *   - hardware_cost, labor_cost, accessories_cost, door_profile_cost
 *   - back_panel_material_cost, box_interior_finish_cost,
 *     doors_interior_finish_cost
 *
 * After the cabinet materials substitution, the remainder of the rollup
 * (items, countertops, closet items, profit, tariff, referral, tax, install,
 * other expenses) is computed with the EXACT SAME formula as sqft mode —
 * that's the whole point of coexistence: only the cabinet material cost
 * differs between the two modes.
 */

import type { AreaWithChildren, QuotationMultipliers } from '../../pricing/computeQuotationTotalsSqft';
import { getCabinetTotalCost } from '../../pricing/getCabinetTotalCost';

export interface OptimizerQuotationTotalInput {
  /** From the optimizer run: sum of board material costs. */
  materialCost: number;
  /** From computeEdgebandCost: total edgeband cost. */
  edgebandCost: number;
  /** Per-cabinet edgeband cost (for cost-equivalence checks). Not required for the total. */
  edgebandPerCabinet?: Record<string, number>;
  /** Areas data as loaded in ProjectDetails (same shape as the sqft helper). */
  areasData: AreaWithChildren[];
  /** Cabinets that produced pieces in the optimizer run. Everything else falls back to ft². */
  cabinetsCovered: Set<string>;
  /** Same multiplier inputs used by the sqft rollup. */
  multipliers: QuotationMultipliers;
  /**
   * Share of `materialCost + edgebandCost` that is attributable to
   * tariffable areas. Kept as an explicit input (not computed inside this
   * pure math function) so the helper stays decoupled from optimizer
   * runtime types. Callers compute it via
   * `computeOptimizerTariffableMaterialsCost()` in
   * `src/lib/optimizer/quotation/computeOptimizerAreaSubtotals.ts`.
   *
   * Replaces the previous all-or-nothing heuristic that dumped the full
   * optimizer materials into the tariff pool whenever ANY covered cabinet
   * lived in a tariffable area — which inflated the optimizer tariff
   * above the ft² tariff for mixed quotations (bug fix).
   */
  tariffableMaterialsCost: number;
}

export interface OptimizerQuotationTotal {
  /** Optimizer boards + edgeband. */
  optimizerMaterialsCost: number;
  /** Sum of non-material cabinet costs (hardware, labor, etc) for covered cabinets. */
  coveredCabinetExtras: number;
  /** Full cabinet.subtotal for cabinets that fell back to ft² (D2 mixed mode). */
  fallbackCabinetsSubtotal: number;
  /** items + countertops + closetItems from the ft² snapshot. */
  nonCabinetSubtotal: number;
  /** Total "materials" subtotal used in the quotation formula. */
  materialsSubtotal: number;
  riskAmount: number;
  price: number;
  tariffableSubtotal: number;
  tariffAmount: number;
  referralAmount: number;
  taxAmount: number;
  fullProjectTotal: number;
}

/**
 * Fields on `area_cabinets` that the optimizer physically replaces. Every
 * material/edgeband cost listed here corresponds to a `cutPieceRole` the
 * optimizer cuts and prices in `materialCost + edgebandCost`, so we MUST
 * subtract them from `cabinet.subtotal` to avoid double-counting them on
 * top of the optimizer's own board/edgeband totals.
 *
 * Originally only `box` and `doors` (the "4 material slots"). The
 * 2026-04-16 schema split added `back_panel_*`, `drawer_box_*` and
 * `shelf_*` as independent slots; the cut-piece engine emits pieces
 * tagged with those roles ('back' / 'drawer_box' / 'shelf') and
 * `buildOptimizerSetupFromQuotation` routes them to the correct
 * material price, so the optimizer's `materialCost` already covers
 * those boards. Subtracting the ft²-estimated cost fields here keeps
 * the Info-tab Materials Subtotal from double-counting them.
 *
 * Fields intentionally NOT listed (the optimizer does NOT replace them
 * — they remain in `extras` on top of optimizer boards):
 *   - box_interior_finish_cost, doors_interior_finish_cost
 *   - door_profile_cost
 *   - hardware / accessories / labor (handled separately)
 */
export const MATERIAL_FIELDS = [
  'box_material_cost',
  'box_edgeband_cost',
  'doors_material_cost',
  'doors_edgeband_cost',
  'back_panel_material_cost',
  'drawer_box_material_cost',
  'drawer_box_edgeband_cost',
  'shelf_material_cost',
  'shelf_edgeband_cost',
] as const;

export function cabinetMaterialCost(cab: Record<string, unknown>): number {
  let total = 0;
  for (const f of MATERIAL_FIELDS) {
    const v = cab[f];
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

export function computeOptimizerQuotationTotal(
  args: OptimizerQuotationTotalInput,
): OptimizerQuotationTotal {
  const {
    materialCost,
    edgebandCost,
    areasData,
    cabinetsCovered,
    multipliers: m,
    tariffableMaterialsCost,
  } = args;

  let coveredCabinetExtras = 0;
  let fallbackCabinetsSubtotal = 0;
  let nonCabinetSubtotal = 0;

  // Each area's total is multiplied by its quantity (mirror sqft helper).
  let weightedCoveredExtras = 0;
  let weightedFallbackCabinets = 0;
  let weightedNonCabinet = 0;

  let weightedTariffableCovered = 0;
  let weightedTariffableFallback = 0;
  let weightedTariffableNonCabinet = 0;

  for (const area of areasData) {
    const qty = area.quantity ?? 1;
    const tariffable = area.applies_tariff === true;

    let areaCoveredExtras = 0;
    let areaFallbackCabinets = 0;

    for (const cab of area.cabinets) {
      // Prefer the live recompute from the 15 cost fields; fall back to
      // `cab.subtotal` when all of them are zero/missing (legacy data +
      // lightweight test fixtures). The denormalized `subtotal` field can
      // drift when a cabinet is edited and the recompute step is missed;
      // the helper makes this self-healing for real data.
      // See src/lib/pricing/getCabinetTotalCost.ts.
      const live = getCabinetTotalCost(cab as unknown as Record<string, unknown>);
      const subtotal = live > 0 ? live : (cab.subtotal ?? 0);
      if (cabinetsCovered.has(cab.id)) {
        // Covered by optimizer → keep only non-material extras.
        const extras = subtotal - cabinetMaterialCost(cab as unknown as Record<string, unknown>);
        areaCoveredExtras += extras;
      } else {
        // Mixed mode: fall back to full ft² subtotal for this cabinet.
        areaFallbackCabinets += subtotal;
      }
    }

    const itemsTotal       = area.items.reduce((s, i) => s + i.subtotal, 0);
    const countertopsTotal = area.countertops.reduce((s, ct) => s + ct.subtotal, 0);
    const closetItemsTotal = area.closetItems.reduce((s, ci) => s + ci.subtotal_mxn, 0);
    const prefabItemsTotal = (area.prefabItems ?? []).reduce((s, pi) => s + pi.cost_mxn, 0);
    const areaNonCabinet   = itemsTotal + countertopsTotal + closetItemsTotal + prefabItemsTotal;

    coveredCabinetExtras     += areaCoveredExtras;
    fallbackCabinetsSubtotal += areaFallbackCabinets;
    nonCabinetSubtotal       += areaNonCabinet;

    weightedCoveredExtras     += areaCoveredExtras     * qty;
    weightedFallbackCabinets  += areaFallbackCabinets  * qty;
    weightedNonCabinet        += areaNonCabinet        * qty;

    if (tariffable) {
      weightedTariffableCovered    += areaCoveredExtras     * qty;
      weightedTariffableFallback   += areaFallbackCabinets  * qty;
      weightedTariffableNonCabinet += areaNonCabinet        * qty;
    }
  }

  const optimizerMaterialsCost = materialCost + edgebandCost;

  // The materials subtotal in optimizer mode is:
  //   boards + edgeband + non-material extras of covered cabinets
  //   + ft² subtotal of fallback cabinets + items + countertops + closet items
  //   + prefab items (Venus / Northville, always ft²-sourced)
  // (The optimizer boards/edgeband are flat across the quotation — not area
  // scaled — because a single project-wide optimizer run produces them, and
  // area.quantity is already encoded into the cabinet.quantity used when
  // generating pieces. So we do NOT re-multiply by area.quantity here.)
  const materialsSubtotal =
    optimizerMaterialsCost +
    weightedCoveredExtras +
    weightedFallbackCabinets +
    weightedNonCabinet;

  const riskPct = m.riskFactorPct ?? 0;
  const riskAmount = riskPct > 0
    ? materialsSubtotal * (riskPct / 100)
    : 0;
  const adjustedSubtotal = materialsSubtotal + riskAmount;

  const price = m.profitMultiplier > 0 && m.profitMultiplier < 1
    ? adjustedSubtotal / (1 - m.profitMultiplier)
    : adjustedSubtotal;

  // Tariffable subtotal mirrors the sqft approach but with the optimizer
  // materials substituted in. The key rule is: tariff only applies to the
  // share of the optimizer materials that was physically cut for cabinets
  // in areas where `applies_tariff === true`. The caller computes that
  // share (m²-proportional for boards + per-cabinet for edgeband) via
  // `computeOptimizerTariffableMaterialsCost` and passes it in as
  // `tariffableMaterialsCost`.
  //
  // Everything else in the tariffable pool (non-material extras of
  // covered cabinets, fallback cabinets' ft² subtotals, and non-cabinet
  // subtotals from items/countertops/closets) is still summed the same
  // way as the sqft helper: by iterating tariffable areas above.
  const tariffableSubtotal =
    tariffableMaterialsCost +
    weightedTariffableCovered +
    weightedTariffableFallback +
    weightedTariffableNonCabinet;

  const tariffAmount   = tariffableSubtotal * m.tariffMultiplier;
  const referralAmount = (price + m.installDeliveryMxn) * m.referralRate;
  const taxAmount      = (price + tariffAmount + referralAmount) * (m.taxPercentage / 100);

  const fullProjectTotal =
    price +
    tariffAmount +
    referralAmount +
    taxAmount +
    m.installDeliveryMxn +
    m.otherExpenses;

  return {
    optimizerMaterialsCost,
    coveredCabinetExtras,
    fallbackCabinetsSubtotal,
    nonCabinetSubtotal,
    materialsSubtotal,
    riskAmount,
    price,
    tariffableSubtotal,
    tariffAmount,
    referralAmount,
    taxAmount,
    fullProjectTotal,
  };
}
