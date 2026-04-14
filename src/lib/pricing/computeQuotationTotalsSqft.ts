/**
 * Pure helper that computes the ft²/per-unit ("sqft") quotation totals.
 *
 * Extracted verbatim from `src/pages/ProjectDetails.tsx` `updateProjectTotal()`
 * (originally lines 259-284) as part of the optimizer-pricing implementation
 * (Phase 2 — no behavior change). The wrapper still owns the Supabase writes;
 * this helper only does math.
 *
 * Math (intentionally byte-identical to the original inline implementation):
 *   1. materialsSubtotal = Σ areas of (cabinets + items + countertops + closetItems) × area.quantity
 *   2. price             = (0 < profit < 1) ? materialsSubtotal / (1 − profit) : materialsSubtotal
 *   3. tariffableSubtotal= same Σ but only for areas where applies_tariff === true
 *   4. tariffAmount      = tariffableSubtotal × tariffMultiplier
 *   5. referralAmount    = (price + installDeliveryMxn) × referralRate
 *   6. taxAmount         = (price + tariffAmount + referralAmount) × (taxPercentage / 100)
 *   7. fullProjectTotal  = price + tariffAmount + referralAmount + taxAmount
 *                          + installDeliveryMxn + otherExpenses
 *   8. perAreaTotal[id]  = cabinets + items + countertops + closetItems
 *                          (without quantity multiplier — matches the per-area
 *                           subtotal write loop at ProjectDetails.tsx:292-302)
 */

import type {
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
  AreaPrefabItem,
} from '../../types';

export interface AreaWithChildren extends ProjectArea {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems: AreaClosetItem[];
  /**
   * Prefab reseller line items (Venus / Northville). Each row carries its
   * own `cost_mxn` snapshot — precomputed at insert time as
   * `quantity × cost_usd × fx_rate`. They flow into `materialsSubtotal`
   * alongside closets, items, and countertops, and are therefore subject
   * to the project-level `profit_multiplier` and `tariff_multiplier` via
   * the same pipeline. They are opaque to the despiece/optimizer engines.
   */
  prefabItems?: AreaPrefabItem[];
}

export interface QuotationMultipliers {
  /** Profit margin as a fraction in [0, 1). 0 disables the gross-up. */
  profitMultiplier: number;
  /** Tariff rate applied to the subtotal of areas with applies_tariff = true. */
  tariffMultiplier: number;
  /** Referral rate applied to (price + installDeliveryMxn). */
  referralRate: number;
  /** Tax percentage (e.g. 16 for 16%). */
  taxPercentage: number;
  /** Install + delivery cost already converted to MXN by the caller. */
  installDeliveryMxn: number;
  /** Lump-sum other expenses in MXN. */
  otherExpenses: number;
}

export interface QuotationTotalsSqft {
  materialsSubtotal: number;
  price: number;
  tariffableSubtotal: number;
  tariffAmount: number;
  referralAmount: number;
  taxAmount: number;
  fullProjectTotal: number;
  /** Per-area sum of cabinets+items+countertops+closetItems (no quantity multiplier). */
  perAreaTotal: Record<string, number>;
}

function sumAreaChildren(area: AreaWithChildren): number {
  // AreaCabinet.subtotal is `number | null` in the DB schema; treat null as 0
  // to match the pre-existing inline behavior in ProjectDetails (which relied
  // on JS `null + number = NaN` being filtered out by upstream UI guards).
  // The other three subtotal fields are `number` in the app types.
  const cabinetsTotal    = area.cabinets.reduce((s, c) => s + (c.subtotal ?? 0), 0);
  const itemsTotal       = area.items.reduce((s, i) => s + i.subtotal, 0);
  const countertopsTotal = area.countertops.reduce((s, ct) => s + ct.subtotal, 0);
  const closetItemsTotal = area.closetItems.reduce((s, ci) => s + ci.subtotal_mxn, 0);
  const prefabItemsTotal = (area.prefabItems ?? []).reduce((s, pi) => s + pi.cost_mxn, 0);
  return cabinetsTotal + itemsTotal + countertopsTotal + closetItemsTotal + prefabItemsTotal;
}

export function computeQuotationTotalsSqft(
  areasData: AreaWithChildren[],
  m: QuotationMultipliers,
): QuotationTotalsSqft {
  const materialsSubtotal = areasData.reduce((sum, area) => {
    const qty = area.quantity ?? 1;
    return sum + sumAreaChildren(area) * qty;
  }, 0);

  const price = m.profitMultiplier > 0 && m.profitMultiplier < 1
    ? materialsSubtotal / (1 - m.profitMultiplier)
    : materialsSubtotal;

  const tariffableSubtotal = areasData.reduce((sum, area) => {
    if (area.applies_tariff !== true) return sum;
    const qty = area.quantity ?? 1;
    return sum + sumAreaChildren(area) * qty;
  }, 0);

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

  const perAreaTotal: Record<string, number> = {};
  for (const area of areasData) {
    perAreaTotal[area.id] = sumAreaChildren(area);
  }

  return {
    materialsSubtotal,
    price,
    tariffableSubtotal,
    tariffAmount,
    referralAmount,
    taxAmount,
    fullProjectTotal,
    perAreaTotal,
  };
}
