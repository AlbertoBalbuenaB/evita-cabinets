/*
  # Add image_url to price_list table

  ## Summary
  Adds a reference image URL field to the price list so users can attach
  a visual reference image to each item. This image URL is optional and
  will be displayed in the item detail modal and card view.

  ## Changes
  - `price_list` table: adds nullable `image_url` text column

  ## Notes
  - Safe conditional add using IF NOT EXISTS check
  - Non-destructive operation, existing rows will have NULL for this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE price_list ADD COLUMN image_url text DEFAULT NULL;
  END IF;
END $$;
