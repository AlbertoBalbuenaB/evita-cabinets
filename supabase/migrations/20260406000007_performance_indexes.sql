/*
  # Performance indexes for new tables

  Covers common query patterns: fetching movements by item or date,
  joining purchase items to projects and price list, and looking up
  price list suppliers.
*/

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON inventory_movements (price_list_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created
  ON inventory_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref
  ON inventory_movements (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_project
  ON project_purchase_items (project_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_price_list
  ON project_purchase_items (price_list_item_id);

CREATE INDEX IF NOT EXISTS idx_price_list_suppliers_item
  ON price_list_suppliers (price_list_item_id);

CREATE INDEX IF NOT EXISTS idx_price_list_suppliers_supplier
  ON price_list_suppliers (supplier_id);
