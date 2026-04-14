import { describe, it, expect } from 'vitest';
import {
  computeQuotationTotalsSqft,
  type AreaWithChildren,
  type QuotationMultipliers,
} from './computeQuotationTotalsSqft';

/**
 * Tests focused on the prefab library integration: prefab rows must flow
 * into `materialsSubtotal` via `sumAreaChildren`, and therefore be scaled
 * automatically by `profit_multiplier` and included in `tariffableSubtotal`
 * when the area has `applies_tariff = true`.
 */

const NO_MULT: QuotationMultipliers = {
  profitMultiplier: 0,
  tariffMultiplier: 0,
  referralRate: 0,
  taxPercentage: 0,
  installDeliveryMxn: 0,
  otherExpenses: 0,
};

function area(
  id: string,
  overrides: Partial<AreaWithChildren> = {},
): AreaWithChildren {
  return {
    id,
    quotation_id: 'q1',
    name: `Area ${id}`,
    quantity: 1,
    applies_tariff: false,
    cabinets: [],
    items: [],
    countertops: [],
    closetItems: [],
    prefabItems: [],
    ...overrides,
  } as AreaWithChildren;
}

describe('computeQuotationTotalsSqft — prefab integration', () => {
  it('prefab-only area contributes cost_mxn to materialsSubtotal', () => {
    const areas: AreaWithChildren[] = [
      area('a1', {
        prefabItems: [
          { id: 'p1', area_id: 'a1', prefab_catalog_id: 'c1', finish: 'Houston Frost',
            quantity: 2, cost_usd: 223, fx_rate: 18, cost_mxn: 2 * 223 * 18, notes: null } as any,
        ],
      }),
    ];
    const totals = computeQuotationTotalsSqft(areas, NO_MULT);
    expect(totals.materialsSubtotal).toBe(2 * 223 * 18);
    expect(totals.perAreaTotal['a1']).toBe(2 * 223 * 18);
  });

  it('profit_multiplier scales the prefab cost like any other line', () => {
    const areas: AreaWithChildren[] = [
      area('a1', {
        prefabItems: [
          { id: 'p1', area_id: 'a1', prefab_catalog_id: 'c1', finish: 'x',
            quantity: 1, cost_usd: 100, fx_rate: 18, cost_mxn: 1800, notes: null } as any,
        ],
      }),
    ];
    const totals = computeQuotationTotalsSqft(areas, { ...NO_MULT, profitMultiplier: 0.25 });
    // price = materialsSubtotal / (1 - 0.25) = 1800 / 0.75 = 2400
    expect(totals.materialsSubtotal).toBe(1800);
    expect(totals.price).toBe(2400);
  });

  it('tariff applies only to prefab in tariffable areas', () => {
    const areas: AreaWithChildren[] = [
      area('a1', {
        applies_tariff: true,
        prefabItems: [{ id: 'p1', area_id: 'a1', prefab_catalog_id: 'c1', finish: 'x',
          quantity: 1, cost_usd: 100, fx_rate: 18, cost_mxn: 1800, notes: null } as any],
      }),
      area('a2', {
        applies_tariff: false,
        prefabItems: [{ id: 'p2', area_id: 'a2', prefab_catalog_id: 'c2', finish: 'x',
          quantity: 1, cost_usd: 50, fx_rate: 18, cost_mxn: 900, notes: null } as any],
      }),
    ];
    const totals = computeQuotationTotalsSqft(areas, { ...NO_MULT, tariffMultiplier: 0.25 });
    expect(totals.materialsSubtotal).toBe(1800 + 900);
    expect(totals.tariffableSubtotal).toBe(1800);
    expect(totals.tariffAmount).toBe(1800 * 0.25);
  });

  it('area.quantity multiplies prefab cost', () => {
    const areas: AreaWithChildren[] = [
      area('a1', {
        quantity: 3,
        prefabItems: [{ id: 'p1', area_id: 'a1', prefab_catalog_id: 'c1', finish: 'x',
          quantity: 1, cost_usd: 100, fx_rate: 18, cost_mxn: 1800, notes: null } as any],
      }),
    ];
    const totals = computeQuotationTotalsSqft(areas, NO_MULT);
    expect(totals.materialsSubtotal).toBe(1800 * 3);
    // perAreaTotal is WITHOUT quantity multiplier (matches the original semantics).
    expect(totals.perAreaTotal['a1']).toBe(1800);
  });

  it('prefab sums alongside cabinets, items, countertops, closets', () => {
    const areas: AreaWithChildren[] = [
      area('a1', {
        cabinets: [{ subtotal: 100 } as any],
        items: [{ subtotal: 50 } as any],
        countertops: [{ subtotal: 25 } as any],
        closetItems: [{ subtotal_mxn: 10 } as any],
        prefabItems: [{ cost_mxn: 5 } as any],
      }),
    ];
    const totals = computeQuotationTotalsSqft(areas, NO_MULT);
    expect(totals.materialsSubtotal).toBe(100 + 50 + 25 + 10 + 5);
  });

  it('missing prefabItems (undefined) is safe — treated as empty', () => {
    const areas: AreaWithChildren[] = [
      area('a1', { cabinets: [{ subtotal: 100 } as any] }),
    ];
    // Remove the default empty array to simulate old persisted data.
    delete (areas[0] as any).prefabItems;
    const totals = computeQuotationTotalsSqft(areas, NO_MULT);
    expect(totals.materialsSubtotal).toBe(100);
  });
});
