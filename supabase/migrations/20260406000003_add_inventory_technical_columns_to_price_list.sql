/*
  # Add inventory and technical columns to price_list

  Inventory tracking: stock levels, costs (weighted average + last purchase).
  Technical info: physical dimensions, weight, material, finish.
*/

-- =====================================================
-- Inventory tracking columns
-- =====================================================
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS stock_quantity      DECIMAL(12,3) DEFAULT 0 NOT NULL;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS min_stock_level     DECIMAL(12,3) DEFAULT 0 NOT NULL;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS stock_location      TEXT;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS average_cost        DECIMAL(12,4) DEFAULT 0;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS last_purchase_cost  DECIMAL(12,4);

-- =====================================================
-- Technical information columns
-- =====================================================
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_width_mm      DECIMAL(10,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_height_mm     DECIMAL(10,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_depth_mm      DECIMAL(10,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_thickness_mm  DECIMAL(10,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS weight                  DECIMAL(10,3);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS weight_unit             TEXT DEFAULT 'kg';
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_material      TEXT;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS technical_finish        TEXT;
