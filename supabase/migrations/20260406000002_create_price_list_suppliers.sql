/*
  # Create price_list_suppliers table

  Links price list items to suppliers with per-supplier SKU, cost, and
  a "primary supplier" flag. Only one supplier can be primary per item
  (enforced by trigger).
*/

CREATE TABLE IF NOT EXISTS price_list_suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id  UUID NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku        TEXT,
  supplier_price      DECIMAL(12,2),
  is_primary          BOOLEAN DEFAULT false NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT price_list_suppliers_unique_item_supplier UNIQUE (price_list_item_id, supplier_id)
);

-- =====================================================
-- Enforce single primary supplier per price list item
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_single_primary_supplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE price_list_suppliers
    SET is_primary = false
    WHERE price_list_item_id = NEW.price_list_item_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_primary_supplier_trigger ON price_list_suppliers;
CREATE TRIGGER enforce_single_primary_supplier_trigger
  BEFORE INSERT OR UPDATE ON price_list_suppliers
  FOR EACH ROW EXECUTE FUNCTION enforce_single_primary_supplier();

-- updated_at trigger
DROP TRIGGER IF EXISTS update_price_list_suppliers_updated_at ON price_list_suppliers;
CREATE TRIGGER update_price_list_suppliers_updated_at
  BEFORE UPDATE ON price_list_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE price_list_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on price_list_suppliers"
  ON price_list_suppliers FOR ALL
  USING (true)
  WITH CHECK (true);
