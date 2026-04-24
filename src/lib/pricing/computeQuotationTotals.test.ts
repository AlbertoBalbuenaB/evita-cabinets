import { describe, it, expect } from 'vitest';
import {
  computeQuotationTotals,
  type QuotationTotalsInput,
} from './computeQuotationTotals';
import type { AreaWithChildren, QuotationMultipliers } from './computeQuotationTotalsSqft';

/**
 * Pinning tests for the unified pricing function. Each test asserts the
 * same fixture produces the expected money amounts; together they prove
 * sqft mode and optimizer mode coexist without drift.
 */

const BASE_MULTIPLIERS: QuotationMultipliers = {
  profitMultiplier: 0.5,
  tariffMultiplier: 0.25,
  referralRate: 0,
  taxPercentage: 8.25,
  installDeliveryMxn: 100_000,
  otherExpenses: 0,
  riskFactorPct: 5,
};

function area(id: string, overrides: Partial<AreaWithChildren> = {}): AreaWithChildren {
  return {
    id,
    quotation_id: 'q1',
    name: `Area ${id}`,
    quantity: 1,
    applies_tariff: true,
    cabinets: [],
    items: [],
    countertops: [],
    closetItems: [],
    prefabItems: [],
    ...overrides,
  } as AreaWithChildren;
}

function cab(id: string, fields: Record<string, number>): any {
  // Set every cost field. getCabinetTotalCost will sum them all.
  return {
    id,
    area_id: 'a1',
    quantity: 1,
    box_material_cost:           fields.box_material_cost           ?? 0,
    box_edgeband_cost:           fields.box_edgeband_cost           ?? 0,
    box_interior_finish_cost:    fields.box_interior_finish_cost    ?? 0,
    doors_material_cost:         fields.doors_material_cost         ?? 0,
    doors_edgeband_cost:         fields.doors_edgeband_cost         ?? 0,
    doors_interior_finish_cost:  fields.doors_interior_finish_cost  ?? 0,
    back_panel_material_cost:    fields.back_panel_material_cost    ?? 0,
    drawer_box_material_cost:    fields.drawer_box_material_cost    ?? 0,
    drawer_box_edgeband_cost:    fields.drawer_box_edgeband_cost    ?? 0,
    shelf_material_cost:         fields.shelf_material_cost         ?? 0,
    shelf_edgeband_cost:         fields.shelf_edgeband_cost         ?? 0,
    hardware_cost:               fields.hardware_cost               ?? 0,
    accessories_cost:            fields.accessories_cost            ?? 0,
    labor_cost:                  fields.labor_cost                  ?? 0,
    door_profile_cost:           fields.door_profile_cost           ?? 0,
    subtotal: null, // force the helper path
  };
}

describe('computeQuotationTotals — sqft mode', () => {
  it('flattens areas into materials, applies risk before profit gross-up', () => {
    const input: QuotationTotalsInput = {
      pricingMethod: 'sqft',
      multipliers: BASE_MULTIPLIERS,
      areasData: [
        area('a1', {
          cabinets: [
            cab('c1', { box_material_cost: 1000, doors_material_cost: 500, hardware_cost: 100, labor_cost: 200 }),
          ],
        }),
      ],
    };
    const out = computeQuotationTotals(input);
    expect(out.pricingMethod).toBe('sqft');
    expect(out.materialsSubtotal).toBe(1800); // 1000+500+100+200
    expect(out.riskAmount).toBe(90); // 5% of 1800
    expect(out.price).toBe((1800 + 90) / (1 - 0.5)); // 3780
    expect(out.profitAmount).toBe(out.price - 1800 - 90); // 1890
    expect(out.tariffableSubtotal).toBe(1800);
    expect(out.tariffAmount).toBe(450);
    expect(out.byCategory.boards).toBe(1500);
    expect(out.byCategory.hardware).toBe(100);
    expect(out.byCategory.labor).toBe(200);
  });

  it('respects area.quantity multiplier on every category', () => {
    const out = computeQuotationTotals({
      pricingMethod: 'sqft',
      multipliers: { ...BASE_MULTIPLIERS, riskFactorPct: 0, profitMultiplier: 0 },
      areasData: [
        area('a1', {
          quantity: 3,
          cabinets: [cab('c1', { box_material_cost: 100, labor_cost: 50 })],
          items: [{ id: 'i1', area_id: 'a1', subtotal: 200 } as any],
        }),
      ],
    });
    expect(out.materialsSubtotal).toBe((100 + 50 + 200) * 3);
    expect(out.byCategory.boards).toBe(100 * 3);
    expect(out.byCategory.labor).toBe(50 * 3);
    expect(out.byCategory.items).toBe(200 * 3);
  });

  it('falls back to cab.subtotal when cost fields are all zero (legacy data)', () => {
    const legacyCab = { id: 'c1', area_id: 'a1', quantity: 1, subtotal: 999 } as any;
    const out = computeQuotationTotals({
      pricingMethod: 'sqft',
      multipliers: { ...BASE_MULTIPLIERS, riskFactorPct: 0, profitMultiplier: 0 },
      areasData: [area('a1', { cabinets: [legacyCab] })],
    });
    expect(out.materialsSubtotal).toBe(999);
  });
});

describe('computeQuotationTotals — optimizer mode', () => {
  it('replaces cabinet board/edgeband cost with optimizer run actuals', () => {
    const cabinetWithMaterials = cab('c1', {
      box_material_cost: 1000,
      box_edgeband_cost: 100,
      doors_material_cost: 500,
      doors_edgeband_cost: 50,
      back_panel_material_cost: 80,
      drawer_box_material_cost: 30,
      hardware_cost: 200,
      labor_cost: 300,
    });
    const out = computeQuotationTotals({
      pricingMethod: 'optimizer',
      multipliers: BASE_MULTIPLIERS,
      areasData: [area('a1', { cabinets: [cabinetWithMaterials] })],
      optimizerRun: {
        materialCost: 1500, // optimizer-derived boards (replaces ft²-est'd box+doors+back+drawer materials)
        edgebandCost: 120,  // replaces ft²-est'd box+doors edgeband
        cabinetsCovered: new Set(['c1']),
        tariffableMaterialsCost: 1500 + 120,
      },
    });
    // extras = subtotal - MATERIAL_FIELDS = (1000+100+500+50+80+30+200+300) - (1000+100+500+50+80+30) = 500 (hardware+labor)
    // materialsSubtotal = 1500 + 120 + 500 = 2120
    expect(out.materialsSubtotal).toBe(2120);
    expect(out.optimizerMaterialsCost).toBe(1620);
    expect(out.byCategory.boards).toBe(1500);   // from optimizer
    expect(out.byCategory.edgeband).toBe(120);  // from optimizer
    expect(out.byCategory.hardware).toBe(200);  // from cabinet
    expect(out.byCategory.labor).toBe(300);     // from cabinet
  });

  it('subtracts interior finish cost in optimizer mode (no double-count of laminate)', () => {
    // Regression for Hospitality Health of Lake Jackson (Apr 2026):
    // buildOptimizerSetupFromQuotation's interior-finish pass emits
    // 'interior-finish' pieces on real laminate stocks, so the laminate
    // cost lands inside `optimizer.materialCost`. The ft²-estimated
    // interior-finish cost fields MUST be subtracted from cabinet.subtotal
    // or they double-bill the laminate as extras on top of boards.
    const cabinetWithInteriorFinish = cab('c1', {
      box_material_cost: 300,           // ft² core (subtracted)
      box_interior_finish_cost: 200,    // ft² laminate (MUST be subtracted)
      doors_material_cost: 200,         // ft² core (subtracted)
      doors_interior_finish_cost: 300,  // ft² laminate (MUST be subtracted)
      hardware_cost: 150,
      labor_cost: 100,
    });
    // subtotal = 300 + 200 + 200 + 300 + 150 + 100 = 1250
    const out = computeQuotationTotals({
      pricingMethod: 'optimizer',
      multipliers: BASE_MULTIPLIERS,
      areasData: [area('a1', { cabinets: [cabinetWithInteriorFinish] })],
      optimizerRun: {
        // Optimizer cut BOTH cores AND laminate on real boards, so
        // materialCost is the total spend on boards including laminate.
        materialCost: 1100,
        edgebandCost: 0,
        cabinetsCovered: new Set(['c1']),
        tariffableMaterialsCost: 1100,
      },
    });
    // MATERIAL_FIELDS now subtracts $300+$200+$200+$300 = $1000.
    // extras = 1250 - 1000 = 250 (hardware 150 + labor 100)
    // materialsSubtotal = 1100 (optimizer) + 250 (extras) = 1350
    expect(out.materialsSubtotal).toBe(1350);
    expect(out.optimizerMaterialsCost).toBe(1100);
    // Interior finish should report 0 in optimizer mode (folded into boards)
    // to avoid the BOM / Analytics showing it twice.
    expect(out.byCategory.interiorFinish).toBe(0);
    expect(out.byCategory.boards).toBe(1100);
    expect(out.byCategory.hardware).toBe(150);
    expect(out.byCategory.labor).toBe(100);
  });

  it('throws when optimizer mode is selected without optimizerRun input', () => {
    expect(() =>
      computeQuotationTotals({
        pricingMethod: 'optimizer',
        multipliers: BASE_MULTIPLIERS,
        areasData: [],
      }),
    ).toThrowError(/requires `optimizerRun`/);
  });
});

describe('computeQuotationTotals — perAreaCabinetSubtotal', () => {
  it('returns per-area cabinet sums without × quantity', () => {
    const out = computeQuotationTotals({
      pricingMethod: 'sqft',
      multipliers: { ...BASE_MULTIPLIERS, riskFactorPct: 0, profitMultiplier: 0 },
      areasData: [
        area('a1', { quantity: 3, cabinets: [cab('c1', { box_material_cost: 100, labor_cost: 50 })] }),
        area('a2', { cabinets: [cab('c2', { hardware_cost: 200 })] }),
      ],
    });
    expect(out.perAreaCabinetSubtotal['a1']).toBe(150); // 100+50, NO ×3
    expect(out.perAreaCabinetSubtotal['a2']).toBe(200);
  });
});
