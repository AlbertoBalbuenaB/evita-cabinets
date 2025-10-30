/*
  # Add Original SF Columns to Products Catalog

  1. Changes
    - Add `original_box_sf` column to store box SF without waste percentage
    - Add `original_doors_fronts_sf` column to store doors SF without waste percentage
    - Copy existing values to original columns (these are the base values)
    - Add metadata column to track if waste has been applied

  2. Notes
    - Existing `box_sf` and `doors_fronts_sf` will be the working values (with waste applied)
    - Original values never change, only working values are updated when waste % changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products_catalog' AND column_name = 'original_box_sf'
  ) THEN
    ALTER TABLE products_catalog ADD COLUMN original_box_sf decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products_catalog' AND column_name = 'original_doors_fronts_sf'
  ) THEN
    ALTER TABLE products_catalog ADD COLUMN original_doors_fronts_sf decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products_catalog' AND column_name = 'waste_applied'
  ) THEN
    ALTER TABLE products_catalog ADD COLUMN waste_applied boolean DEFAULT false;
  END IF;
END $$;

UPDATE products_catalog
SET 
  original_box_sf = box_sf,
  original_doors_fronts_sf = doors_fronts_sf,
  waste_applied = false
WHERE original_box_sf IS NULL;
