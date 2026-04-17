/**
 * Recompute a single cabinet's total cost from its denormalized cost fields.
 *
 * `area_cabinets.subtotal` is a denormalized cache that is supposed to equal
 * the sum of the per-component cost fields below, but it can drift out of sync
 * when a cabinet is edited and the recompute step is skipped (we found 2 such
 * cabinets in 2701 Beat Creek - Version Plus, with $589.88 of missing cost).
 *
 * Use this helper anywhere a downstream calculation needs the cabinet total
 * — the `subtotal` field should only be read for display in places where a
 * stale cached value is acceptable.
 */

const COST_FIELDS = [
  'box_material_cost',
  'box_edgeband_cost',
  'box_interior_finish_cost',
  'doors_material_cost',
  'doors_edgeband_cost',
  'doors_interior_finish_cost',
  'back_panel_material_cost',
  'drawer_box_material_cost',
  'drawer_box_edgeband_cost',
  'shelf_material_cost',
  'shelf_edgeband_cost',
  'hardware_cost',
  'accessories_cost',
  'labor_cost',
  'door_profile_cost',
] as const;

export function getCabinetTotalCost(cab: Record<string, unknown>): number {
  let total = 0;
  for (const f of COST_FIELDS) {
    const v = cab[f];
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

export { COST_FIELDS };
