-- Add cut list (despiece) and dimension storage to products_catalog
ALTER TABLE products_catalog
  ADD COLUMN IF NOT EXISTS cut_pieces JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS height_in  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS width_in   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS depth_in   DECIMAL(10,2);
