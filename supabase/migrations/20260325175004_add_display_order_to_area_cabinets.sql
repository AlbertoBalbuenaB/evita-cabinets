/*
  # Add display_order to area_cabinets

  ## Summary
  Adds a display_order column to the area_cabinets table to support manual
  cabinet reordering within areas in the Pricing tab.

  ## Changes
  - New column `display_order` (integer, default 0) on `area_cabinets`
  - Backfills existing rows with sequential order per area based on created_at
  - Adds index on (area_id, display_order) for efficient ordering queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'area_cabinets' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE area_cabinets ADD COLUMN display_order integer DEFAULT 0;
  END IF;
END $$;

WITH ordered AS (
  SELECT id, area_id,
    ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY created_at ASC) - 1 AS rn
  FROM area_cabinets
)
UPDATE area_cabinets
SET display_order = ordered.rn
FROM ordered
WHERE area_cabinets.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_area_cabinets_area_display_order
  ON area_cabinets (area_id, display_order);
