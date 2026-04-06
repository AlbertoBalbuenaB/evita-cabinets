/*
  # Create suppliers table

  Adds a suppliers table for managing vendor/supplier information used
  in price list items and purchase orders.
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  contact_name     TEXT,
  phone            TEXT,
  email            TEXT,
  website          TEXT,
  payment_terms    TEXT,
  lead_time_days   INTEGER,
  notes            TEXT,
  is_active        BOOLEAN DEFAULT true NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- updated_at trigger (reuses existing function)
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on suppliers"
  ON suppliers FOR ALL
  USING (true)
  WITH CHECK (true);
