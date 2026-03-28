/*
  # Add Per-Product Configurable Fields

  ## Summary
  Adds three new configurable columns to products_catalog that replace
  hardcoded logic in calculations.ts and boxesAndPallets.ts.

  ## New Columns on products_catalog

  1. `custom_labor_cost` (numeric, nullable)
     - NULL = use global labor cost from Settings
     - A numeric value overrides the global labor cost for this product only

  2. `boxes_per_unit` (integer, NOT NULL, default 1)
     - How many shipping boxes this product occupies
     - Replaces hardcoded description-string checks for Tall Storage / Double Oven

  3. `default_is_rta` (boolean, NOT NULL, default false)
     - When a cabinet using this product is added to a project area,
       is_rta on the new area_cabinet defaults to this value

  ## Data Migration
  - Sets boxes_per_unit = 2 for products whose description contains
    "Tall Storage" or "Double Oven"
  - Sets custom_labor_cost = 100 for products whose SKU starts with "460"
  - All other products keep defaults (boxes_per_unit=1, custom_labor_cost=NULL)

  ## Security
  - No RLS changes needed; existing policies on products_catalog apply to
    the new columns automatically
*/

ALTER TABLE products_catalog
  ADD COLUMN IF NOT EXISTS custom_labor_cost numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS boxes_per_unit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_is_rta boolean NOT NULL DEFAULT false;

UPDATE products_catalog
SET boxes_per_unit = 2
WHERE description ILIKE '%Tall Storage%'
   OR description ILIKE '%Double Oven%';

UPDATE products_catalog
SET custom_labor_cost = 100
WHERE sku LIKE '460%';
