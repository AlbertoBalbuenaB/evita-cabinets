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
  price: number;
  tariffableSubtotal: number;
  tariffAmount: number;
  referralAmount: number;
  taxAmount: number;
  fullProjectTotal: number;
}

/**
 * Fields on `area_cabinets` that the optimizer replaces (the "4 material slots").
 * These are subtracted from `cabinet.subtotal` to obtain the non-material
 * extras that must be added on top of the optimizer boards + edgeband.
 */
const MATERIAL_FIELDS = [
  'box_material_cost',
  'box_edgeband_cost',
  'doors_material_cost',
  'doors_edgeband_cost',
] as const;

function cabinetMaterialCost(cab: Record<string, unknown>): number {
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
  const { materialCost, edgebandCost, areasData, cabinetsCovered, multipliers: m } = args;

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
      const subtotal = typeof cab.subtotal === 'number' && Number.isFinite(cab.subtotal) ? cab.subtotal : 0;
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
    const areaNonCabinet   = itemsTotal + countertopsTotal + closetItemsTotal;

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
  // (The optimizer boards/edgeband are flat across the quotation — not area
  // scaled — because a single project-wide optimizer run produces them, and
  // area.quantity is already encoded into the cabinet.quantity used when
  // generating pieces. So we do NOT re-multiply by area.quantity here.)
  const materialsSubtotal =
    optimizerMaterialsCost +
    weightedCoveredExtras +
    weightedFallbackCabinets +
    weightedNonCabinet;

  const price = m.profitMultiplier > 0 && m.profitMultiplier < 1
    ? materialsSubtotal / (1 - m.profitMultiplier)
    : materialsSubtotal;

  // Tariffable subtotal mirrors the sqft approach but with the same
  // substitution: optimizer materials are flat (not weighted per area),
  // and we proportionally allocate them to tariffable vs non-tariffable
  // based on the tariffable weighted share of cabinet extras.
  // Simpler and defensible: apply the full optimizer materials to the
  // tariffable pool ONLY if at least one covered cabinet sits in a
  // tariffable area — otherwise zero. This matches the existing sqft
  // policy at the area level (all-or-nothing per area).
  const anyTariffableCoveredCabinet = areasData.some(
    (a) =>
      a.applies_tariff === true &&
      a.cabinets.some((c) => cabinetsCovered.has(c.id)),
  );

  const tariffableSubtotal =
    (anyTariffableCoveredCabinet ? optimizerMaterialsCost : 0) +
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
    price,
    tariffableSubtotal,
    tariffAmount,
    referralAmount,
    taxAmount,
    fullProjectTotal,
  };
}
