/*
  # Add product_url to price_list table

  ## Summary
  Adds a new optional column `product_url` to the `price_list` table so users
  can store a web link referencing the supplier or product page for each price
  list item.

  ## Changes
  - `price_list` table: new nullable `product_url` (text) column
    - Stores a URL pointing to the product/supplier web page
    - Optional — existing rows are unaffected (default NULL)

  ## Notes
  1. No RLS changes needed — the column inherits the existing table policies.
  2. Safe operation: uses conditional add so it will not fail if run twice.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'product_url'
  ) THEN
    ALTER TABLE price_list ADD COLUMN product_url text DEFAULT NULL;
  END IF;
END $$;
