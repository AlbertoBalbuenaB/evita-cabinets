/**
 * Unit tests for `computeOptimizerQuotationTotal` — focused on the
 * tariffable-subtotal bug fix that replaced the all-or-nothing
 * `anyTariffableCoveredCabinet` heuristic with an explicit
 * `tariffableMaterialsCost` input computed by the caller via
 * `computeOptimizerTariffableMaterialsCost()`.
 *
 * The tests cover the three meaningful cases for the tariff rule:
 *   1. All areas tariffable  → tariff includes 100% of optimizer materials
 *   2. No areas tariffable   → tariff includes 0% of optimizer materials
 *   3. Mixed                 → tariff includes exactly the caller-supplied share
 *
 * Plus a regression case with no multipliers so the resulting total
 * equals `materialsSubtotal` (no markup) and confirms that profit / tax /
 * referral aren't being accidentally double-applied.
 */

import { describe, it, expect } from 'vitest';
import { computeOptimizerQuotationTotal } from './computeOptimizerQuotationTotal';
import type { AreaWithChildren } from '../../pricing/computeQuotationTotalsSqft';
import type {
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
} from '../../../types';

// ── Tiny test fixtures ─────────────────────────────────────────────────────

/**
 * Build a fake `AreaCabinet` row where `subtotal` equals the sum of the
 * four material fields used by MATERIAL_FIELDS + a fixed $100 labor cost
 * (labor is in `subtotal` but NOT in MATERIAL_FIELDS). This mirrors the
 * shape read by `cabinetMaterialCost()` inside computeOptimizerQuotationTotal.
 */
function makeCabinet(id: string, materialCost: number, labor = 100): AreaCabinet {
  const box = materialCost / 2;
  const doors = materialCost / 2;
  return {
    id,
    area_id: 'area-stub',
    product_sku: 'SKU-STUB',
    quantity: 1,
    box_material_cost: box,
    box_edgeband_cost: 0,
    box_interior_finish_cost: 0,
    doors_material_cost: doors,
    doors_edgeband_cost: 0,
    doors_interior_finish_cost: 0,
    hardware_cost: 0,
    accessories_cost: 0,
    labor_cost: labor,
    back_panel_material_cost: 0,
    door_profile_cost: 0,
    subtotal: materialCost + labor,
    // Misc unused fields — cast to any since we only need the pricing-math
    // shape. Tests don't touch the DB so the full Row type isn't required.
  } as unknown as AreaCabinet;
}

function makeArea(
  id: string,
  name: string,
  opts: {
    appliesTariff: boolean;
    quantity?: number;
    cabinets?: AreaCabinet[];
    items?: AreaItem[];
    countertops?: AreaCountertop[];
    closetItems?: AreaClosetItem[];
  },
): AreaWithChildren {
  return {
    id,
    project_id: 'quotation-stub',
    name,
    display_order: 0,
    quantity: opts.quantity ?? 1,
    subtotal: 0,
    applies_tariff: opts.appliesTariff,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    cabinets: opts.cabinets ?? [],
    items: opts.items ?? [],
    countertops: opts.countertops ?? [],
    closetItems: opts.closetItems ?? [],
  } as unknown as AreaWithChildren;
}

// Pricing multipliers that match the VERSION PLUS screenshots from the
// bug report (25% tariff, no profit/tax/referral/install so the math is
// easy to verify by hand).
const MULT_TARIFF_ONLY = {
  profitMultiplier: 0,
  tariffMultiplier: 0.25,
  referralRate: 0,
  taxPercentage: 0,
  installDeliveryMxn: 0,
  otherExpenses: 0,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('computeOptimizerQuotationTotal — tariff allocation', () => {
  it('all areas tariffable → full optimizer materials enter tariff pool', () => {
    const cab1 = makeCabinet('cab-1', 500); // $500 material + $100 labor
    const cab2 = makeCabinet('cab-2', 700);
    const area = makeArea('area-a', 'Kitchen', {
      appliesTariff: true,
      cabinets: [cab1, cab2],
    });

    const result = computeOptimizerQuotationTotal({
      materialCost: 800, // boards-only cost from the optimizer run
      edgebandCost: 200, // edgeband cost from the run
      areasData: [area],
      cabinetsCovered: new Set(['cab-1', 'cab-2']),
      tariffableMaterialsCost: 1000, // caller computed: whole $1000 is tariffable
      multipliers: MULT_TARIFF_ONLY,
    });

    // Cabinet "extras" = subtotal − MATERIAL_FIELDS
    //   cab1: ($500 + $100) − $500 = $100
    //   cab2: ($700 + $100) − $700 = $100
    //   → weightedCoveredExtras = $200
    // materialsSubtotal = optimizerMaterials ($1000) + extras ($200) = $1200
    expect(result.materialsSubtotal).toBeCloseTo(1200, 2);

    // tariffableSubtotal = $1000 (caller) + $200 (covered extras from tariffable area)
    expect(result.tariffableSubtotal).toBeCloseTo(1200, 2);

    // tariffAmount = $1200 × 0.25 = $300
    expect(result.tariffAmount).toBeCloseTo(300, 2);
  });

  it('no areas tariffable → optimizer materials contribute ZERO tariff', () => {
    const cab1 = makeCabinet('cab-1', 500);
    const cab2 = makeCabinet('cab-2', 700);
    const area = makeArea('area-a', 'Kitchen', {
      appliesTariff: false,
      cabinets: [cab1, cab2],
    });

    const result = computeOptimizerQuotationTotal({
      materialCost: 800,
      edgebandCost: 200,
      areasData: [area],
      cabinetsCovered: new Set(['cab-1', 'cab-2']),
      tariffableMaterialsCost: 0, // caller: no tariffable area → $0
      multipliers: MULT_TARIFF_ONLY,
    });

    // materialsSubtotal unchanged
    expect(result.materialsSubtotal).toBeCloseTo(1200, 2);
    // No tariffable area → everything tariffable is 0
    expect(result.tariffableSubtotal).toBeCloseTo(0, 2);
    expect(result.tariffAmount).toBeCloseTo(0, 2);
  });

  it('mixed areas → tariffable-materials share applies proportionally', () => {
    // Two areas: one tariffable (Kitchen, 30% share), one not (Closet, 70%).
    // The caller would compute tariffableMaterialsCost = $300 from the
    // allocateBoardCostsByArea + per-cabinet edgeband helper.
    const kitchenCab = makeCabinet('cab-k', 200);  // 30% slice
    const closetCab = makeCabinet('cab-c', 600);   // 70% slice
    const kitchen = makeArea('area-k', 'Kitchen', {
      appliesTariff: true,
      cabinets: [kitchenCab],
    });
    const closet = makeArea('area-c', 'Closet', {
      appliesTariff: false,
      cabinets: [closetCab],
    });

    const result = computeOptimizerQuotationTotal({
      materialCost: 800,
      edgebandCost: 200,
      areasData: [kitchen, closet],
      cabinetsCovered: new Set(['cab-k', 'cab-c']),
      tariffableMaterialsCost: 300, // exact 30% of $1000
      multipliers: MULT_TARIFF_ONLY,
    });

    // materialsSubtotal = $1000 (optimizer) + $200 (extras = $100 per cab × 2)
    expect(result.materialsSubtotal).toBeCloseTo(1200, 2);

    // tariffableSubtotal = $300 (materials share) + $100 (Kitchen cab extras only)
    expect(result.tariffableSubtotal).toBeCloseTo(400, 2);

    // tariffAmount = $400 × 0.25 = $100
    expect(result.tariffAmount).toBeCloseTo(100, 2);
  });

  it('regression: with no multipliers, grand total equals materialsSubtotal', () => {
    const cab = makeCabinet('cab-1', 1000, 0);
    const area = makeArea('area-a', 'Kitchen', {
      appliesTariff: false,
      cabinets: [cab],
    });

    const result = computeOptimizerQuotationTotal({
      materialCost: 800,
      edgebandCost: 200,
      areasData: [area],
      cabinetsCovered: new Set(['cab-1']),
      tariffableMaterialsCost: 0,
      multipliers: {
        profitMultiplier: 0,
        tariffMultiplier: 0,
        referralRate: 0,
        taxPercentage: 0,
        installDeliveryMxn: 0,
        otherExpenses: 0,
      },
    });

    // materialsSubtotal = $1000 (optimizer) + $0 (cab has no labor, extras = 0)
    expect(result.materialsSubtotal).toBeCloseTo(1000, 2);
    expect(result.price).toBeCloseTo(1000, 2);
    expect(result.tariffAmount).toBeCloseTo(0, 2);
    expect(result.referralAmount).toBeCloseTo(0, 2);
    expect(result.taxAmount).toBeCloseTo(0, 2);
    expect(result.fullProjectTotal).toBeCloseTo(1000, 2);
  });

  it('bug repro: tariff in optimizer mode must NOT exceed sqft tariff when only one mixed area is tariffable', () => {
    // Reproduce the essence of the user's VERSION PLUS screenshots: two
    // areas where the NON-tariffable area has most of the cabinets/pieces.
    // Under the old heuristic, optimizerMaterialsCost went entirely into
    // the tariff pool because SOME tariffable area had a covered cabinet.
    // Under the fix, only the actual tariffable share counts.
    const bigNonTariffable = makeArea('area-big', 'Closet', {
      appliesTariff: false,
      cabinets: [makeCabinet('cab-big-1', 2000), makeCabinet('cab-big-2', 2000)],
    });
    const smallTariffable = makeArea('area-small', 'Kitchen', {
      appliesTariff: true,
      cabinets: [makeCabinet('cab-small', 400)],
    });

    const materialCost = 3500;
    const edgebandCost = 500;
    const totalOptMaterials = materialCost + edgebandCost; // $4000

    // Caller computes: say the small tariffable area consumed only ~10%
    // of the boards + edgeband.
    const tariffableMaterialsCost = 400;

    const result = computeOptimizerQuotationTotal({
      materialCost,
      edgebandCost,
      areasData: [bigNonTariffable, smallTariffable],
      cabinetsCovered: new Set(['cab-big-1', 'cab-big-2', 'cab-small']),
      tariffableMaterialsCost,
      multipliers: MULT_TARIFF_ONLY,
    });

    // The tariffableSubtotal should include the $400 share PLUS the extras
    // from the tariffable area only ($100 labor from cab-small).
    expect(result.tariffableSubtotal).toBeCloseTo(500, 2);

    // And the tariff amount is much lower than it would have been under
    // the old all-or-nothing rule, which would have dumped the full
    // $4000 + $300 = $4300 into the tariff pool → $1075 tariff.
    // Under the fix: $500 × 0.25 = $125 tariff.
    expect(result.tariffAmount).toBeCloseTo(125, 2);
    expect(result.tariffAmount).toBeLessThan(totalOptMaterials * 0.25);
  });
});
