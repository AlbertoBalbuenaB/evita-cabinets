/**
 * Unified pricing function — single source of truth for quotation totals.
 *
 * Replaces the parallel implementations across the Info tab, Breakdown tab,
 * Analytics tab, and PDF print path. Internally delegates to the existing
 * `computeQuotationTotalsSqft` and `computeOptimizerQuotationTotal` helpers
 * (so all three legacy/test paths keep their numerical contracts) and adds
 * the missing pieces:
 *
 *   1. `byCategory` — per-category materials breakdown (boards, edgeband,
 *      hardware, labor, items, ...) so Analytics can stop aggregating
 *      fields by hand.
 *   2. `perAreaCabinetSubtotal` — per-area cabinet sum without the area
 *      quantity multiplier, for BreakdownBOM and Analytics.
 *   3. `profitAmount` — back-derived from `price - subtotal - risk` so a
 *      clean Profit line can be displayed alongside the Risk line.
 *   4. Stable contract regardless of pricing mode — callers pick the mode
 *      via `pricingMethod`, the function handles the wiring.
 *
 * This is Phase B of the unified totals refactor. See
 * .claude/plans/unified-quotation-totals.md.
 */

import {
  computeQuotationTotalsSqft,
  type AreaWithChildren,
  type QuotationMultipliers,
} from './computeQuotationTotalsSqft';
import { computeOptimizerQuotationTotal } from '../optimizer/quotation/computeOptimizerQuotationTotal';
import { getCabinetTotalCost } from './getCabinetTotalCost';

export type PricingMethod = 'sqft' | 'optimizer';

export interface QuotationTotalsInput {
  pricingMethod: PricingMethod;
  areasData: AreaWithChildren[];
  multipliers: QuotationMultipliers;
  /** Required when pricingMethod === 'optimizer'. */
  optimizerRun?: {
    materialCost: number;
    edgebandCost: number;
    cabinetsCovered: Set<string>;
    /** Share of optimizer materials attributable to tariffable areas. */
    tariffableMaterialsCost: number;
  };
}

export interface QuotationTotalsByCategory {
  /** Box + doors + back + drawer_box + shelf material costs. */
  boards: number;
  /** Box + doors + drawer_box + shelf edgeband costs. */
  edgeband: number;
  hardware: number;
  accessories: number;
  /** Box + doors interior finish. */
  interiorFinish: number;
  doorProfile: number;
  labor: number;
  items: number;
  countertops: number;
  closetItems: number;
  prefabItems: number;
}

export interface QuotationTotals {
  pricingMethod: PricingMethod;

  // ── Top-level subtotals (each multiplied by area.quantity already) ──────
  materialsSubtotal: number;

  // ── Pricing math ────────────────────────────────────────────────────────
  riskFactorPct: number;
  riskAmount: number;
  /** Back-derived: price - materialsSubtotal - riskAmount. */
  profitAmount: number;
  /** Pre-tax. */
  price: number;

  // ── Tariff / tax / shipping / extras ────────────────────────────────────
  tariffableSubtotal: number;
  tariffAmount: number;
  referralAmount: number;
  taxAmount: number;
  installDeliveryMxn: number;
  otherExpenses: number;
  fullProjectTotal: number;

  // ── Per-area breakdowns ─────────────────────────────────────────────────
  /** Full area cost (cabinets + items + countertops + closets + prefabs),
   *  WITHOUT × area.quantity. Matches the contract used by ProjectDetails. */
  perAreaTotal: Record<string, number>;
  /** Per-area cabinet-only sum, WITHOUT × area.quantity. Used by Analytics
   *  + BreakdownBOM to attribute optimizer boards back to each area. */
  perAreaCabinetSubtotal: Record<string, number>;

  // ── Category breakdown (× area.quantity included) ───────────────────────
  byCategory: QuotationTotalsByCategory;

  // ── Optimizer-specific diagnostics (undefined in sqft mode) ─────────────
  optimizerMaterialsCost?: number;
  fallbackCabinetsSubtotal?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sum a single per-cabinet field across all cabinets in all areas, weighted
 *  by area.quantity. Used for byCategory aggregation. Cabinets with no value
 *  for the field contribute 0. */
function sumCabinetField(areas: AreaWithChildren[], field: string): number {
  let total = 0;
  for (const area of areas) {
    const qty = area.quantity ?? 1;
    for (const cab of area.cabinets) {
      const v = (cab as unknown as Record<string, unknown>)[field];
      if (typeof v === 'number' && Number.isFinite(v)) total += v * qty;
    }
  }
  return total;
}

/** Sum item.subtotal across an area's items. */
function sumAreaItems(area: AreaWithChildren): number {
  return area.items.reduce((s, i) => s + i.subtotal, 0);
}
function sumAreaCountertops(area: AreaWithChildren): number {
  return area.countertops.reduce((s, c) => s + c.subtotal, 0);
}
function sumAreaClosets(area: AreaWithChildren): number {
  return area.closetItems.reduce((s, c) => s + c.subtotal_mxn, 0);
}
function sumAreaPrefabs(area: AreaWithChildren): number {
  return (area.prefabItems ?? []).reduce((s, p) => s + p.cost_mxn, 0);
}

/** Cabinet-only sum for an area, no × area.quantity. */
function sumAreaCabinets(area: AreaWithChildren): number {
  return area.cabinets.reduce((s, c) => {
    const live = getCabinetTotalCost(c as unknown as Record<string, unknown>);
    return s + (live > 0 ? live : (c.subtotal ?? 0));
  }, 0);
}

/** Build the byCategory breakdown. In optimizer mode, boards/edgeband come
 *  from the optimizer run; everything else comes from the per-cabinet fields
 *  (so the values reflect the actual data the user entered, regardless of
 *  pricing mode). */
function buildByCategory(
  areas: AreaWithChildren[],
  optimizer?: QuotationTotalsInput['optimizerRun'],
): QuotationTotalsByCategory {
  // Cabinet-derived categories — the same per-area-quantity aggregation rule
  // as the per-cabinet "extras" math in computeOptimizerQuotationTotal.
  const sumPerArea = (perAreaFn: (a: AreaWithChildren) => number) =>
    areas.reduce((s, a) => s + perAreaFn(a) * (a.quantity ?? 1), 0);

  const itemsTotal       = sumPerArea(sumAreaItems);
  const countertopsTotal = sumPerArea(sumAreaCountertops);
  const closetItemsTotal = sumPerArea(sumAreaClosets);
  const prefabItemsTotal = sumPerArea(sumAreaPrefabs);

  const hardware       = sumCabinetField(areas, 'hardware_cost');
  const accessories    = sumCabinetField(areas, 'accessories_cost');
  const labor          = sumCabinetField(areas, 'labor_cost');
  const doorProfile    = sumCabinetField(areas, 'door_profile_cost');
  const interiorFinish =
    sumCabinetField(areas, 'box_interior_finish_cost') +
    sumCabinetField(areas, 'doors_interior_finish_cost');

  // Boards + edgeband: optimizer run actuals when in optimizer mode, else
  // the sum of the ft²-estimated per-cabinet material/edgeband fields.
  let boards: number;
  let edgeband: number;
  if (optimizer) {
    boards = optimizer.materialCost;
    edgeband = optimizer.edgebandCost;
  } else {
    boards =
      sumCabinetField(areas, 'box_material_cost') +
      sumCabinetField(areas, 'doors_material_cost') +
      sumCabinetField(areas, 'back_panel_material_cost') +
      sumCabinetField(areas, 'drawer_box_material_cost') +
      sumCabinetField(areas, 'shelf_material_cost');
    edgeband =
      sumCabinetField(areas, 'box_edgeband_cost') +
      sumCabinetField(areas, 'doors_edgeband_cost') +
      sumCabinetField(areas, 'drawer_box_edgeband_cost') +
      sumCabinetField(areas, 'shelf_edgeband_cost');
  }

  return {
    boards,
    edgeband,
    hardware,
    accessories,
    interiorFinish,
    doorProfile,
    labor,
    items: itemsTotal,
    countertops: countertopsTotal,
    closetItems: closetItemsTotal,
    prefabItems: prefabItemsTotal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function computeQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  const { pricingMethod, areasData, multipliers, optimizerRun } = input;

  // Per-area cabinet subtotal (no × area.quantity), used by both modes for
  // downstream consumers (Analytics, BreakdownBOM).
  const perAreaCabinetSubtotal: Record<string, number> = {};
  for (const area of areasData) {
    perAreaCabinetSubtotal[area.id] = sumAreaCabinets(area);
  }

  if (pricingMethod === 'optimizer') {
    if (!optimizerRun) {
      throw new Error(
        'computeQuotationTotals: pricingMethod="optimizer" requires `optimizerRun` input.',
      );
    }
    const opt = computeOptimizerQuotationTotal({
      materialCost:    optimizerRun.materialCost,
      edgebandCost:    optimizerRun.edgebandCost,
      areasData,
      cabinetsCovered: optimizerRun.cabinetsCovered,
      tariffableMaterialsCost: optimizerRun.tariffableMaterialsCost,
      multipliers,
    });

    const profitAmount = opt.price - opt.materialsSubtotal - opt.riskAmount;

    return {
      pricingMethod,
      materialsSubtotal:        opt.materialsSubtotal,
      riskFactorPct:            multipliers.riskFactorPct ?? 0,
      riskAmount:               opt.riskAmount,
      profitAmount,
      price:                    opt.price,
      tariffableSubtotal:       opt.tariffableSubtotal,
      tariffAmount:             opt.tariffAmount,
      referralAmount:           opt.referralAmount,
      taxAmount:                opt.taxAmount,
      installDeliveryMxn:       multipliers.installDeliveryMxn,
      otherExpenses:            multipliers.otherExpenses,
      fullProjectTotal:         opt.fullProjectTotal,
      perAreaTotal:             buildPerAreaTotal(areasData),
      perAreaCabinetSubtotal,
      byCategory:               buildByCategory(areasData, optimizerRun),
      optimizerMaterialsCost:   opt.optimizerMaterialsCost,
      fallbackCabinetsSubtotal: opt.fallbackCabinetsSubtotal,
    };
  }

  // sqft mode
  const sqft = computeQuotationTotalsSqft(areasData, multipliers);
  const profitAmount = sqft.price - sqft.materialsSubtotal - sqft.riskAmount;

  return {
    pricingMethod,
    materialsSubtotal:  sqft.materialsSubtotal,
    riskFactorPct:      multipliers.riskFactorPct ?? 0,
    riskAmount:         sqft.riskAmount,
    profitAmount,
    price:              sqft.price,
    tariffableSubtotal: sqft.tariffableSubtotal,
    tariffAmount:       sqft.tariffAmount,
    referralAmount:     sqft.referralAmount,
    taxAmount:          sqft.taxAmount,
    installDeliveryMxn: multipliers.installDeliveryMxn,
    otherExpenses:      multipliers.otherExpenses,
    fullProjectTotal:   sqft.fullProjectTotal,
    perAreaTotal:       sqft.perAreaTotal,
    perAreaCabinetSubtotal,
    byCategory:         buildByCategory(areasData, undefined),
  };
}

function buildPerAreaTotal(areas: AreaWithChildren[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const area of areas) {
    out[area.id] =
      sumAreaCabinets(area) +
      sumAreaItems(area) +
      sumAreaCountertops(area) +
      sumAreaClosets(area) +
      sumAreaPrefabs(area);
  }
  return out;
}
