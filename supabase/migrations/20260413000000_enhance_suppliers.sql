-- Add new columns to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS quality_score SMALLINT CHECK (quality_score BETWEEN 1 AND 5);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS punctuality TEXT CHECK (punctuality IN ('Alta', 'Media', 'Baja'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_evaluation_date DATE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_terms TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS special_discounts TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC(12,2);

-- GIN index for fast array search on categories
CREATE INDEX IF NOT EXISTS idx_suppliers_categories ON suppliers USING GIN (categories);

-- Create supplier_logs table
CREATE TABLE IF NOT EXISTS supplier_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  log_type TEXT NOT NULL DEFAULT 'note',
  comment TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_supplier_logs_supplier_id ON supplier_logs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_logs_created_at ON supplier_logs(created_at DESC);

-- Enable RLS
ALTER TABLE supplier_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON supplier_logs;
CREATE POLICY "Allow all for authenticated" ON supplier_logs
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for anon" ON supplier_logs;
CREATE POLICY "Allow all for anon" ON supplier_logs
  FOR ALL USING (auth.role() = 'anon');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_supplier_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_supplier_logs_updated_at ON supplier_logs;
CREATE TRIGGER set_supplier_logs_updated_at
  BEFORE UPDATE ON supplier_logs
  FOR EACH ROW EXECUTE FUNCTION update_supplier_logs_updated_at();
