/*
  # Add Prefab Closets System

  ## Summary
  This migration creates the infrastructure for the Prefab Closets feature, which allows closet
  cabinet items from a catalog to be added to project areas — just like countertops and accessories.

  ## New Tables

  ### closet_catalog
  Stores the prefab closet product catalog (Evita Plus / Evita Premium lines).
  - `id` - UUID primary key
  - `cabinet_code` - Unique product code (e.g., COS1812)
  - `evita_line` - Either 'Evita Plus' or 'Evita Premium'
  - `description` - Product description
  - `height_in`, `width_in`, `depth_in` - Dimensions in inches
  - `price_with_backs_usd` - Price when cabinet includes back panels (USD)
  - `price_without_backs_usd` - Price when backs are excluded (NULL if not available)
  - `has_backs_option` - True when customer can choose with/without backs
  - `boxes_count` - Shipping boxes: 1 if height <= 42", else 2
  - `dimensions_locked` - Prevents editing dimensions on seeded rows
  - `is_active` - Soft-delete flag
  - `created_at`, `updated_at` - Timestamps

  ### area_closet_items
  Per-area closet items added to a project, analogous to area_countertops.
  - `id` - UUID primary key
  - `area_id` - FK to project_areas (CASCADE DELETE)
  - `closet_catalog_id` - FK to closet_catalog
  - `quantity` - Number of units
  - `with_backs` - Whether this item includes backs
  - `unit_price_usd` - Catalog price in USD at time of save
  - `unit_price_mxn` - Converted MXN price at time of save
  - `hardware` - JSON array of attached hardware items
  - `hardware_cost` - Computed hardware cost in MXN
  - `subtotal_mxn` - Total cost (unit_price_mxn × qty + hardware_cost)
  - `boxes_count` - Copied from catalog at save time
  - `notes` - Optional notes
  - `created_at`, `updated_at` - Timestamps

  ## Security
  - RLS enabled on both tables
  - Anon access allowed (matches existing pattern in this app)

  ## Notes
  1. Prices in closet_catalog are stored in USD — never converted at seed time
  2. unit_price_mxn and subtotal_mxn are computed at save time using current exchange rate
  3. boxes_count uses RTA divisor (19) for pallet calculations
*/

CREATE TABLE IF NOT EXISTS closet_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_code text NOT NULL UNIQUE,
  evita_line text NOT NULL CHECK (evita_line IN ('Evita Plus','Evita Premium')),
  description text NOT NULL,
  height_in numeric NOT NULL,
  width_in numeric NOT NULL,
  depth_in numeric NOT NULL,
  price_with_backs_usd numeric,
  price_without_backs_usd numeric,
  has_backs_option boolean NOT NULL DEFAULT true,
  boxes_count integer NOT NULL DEFAULT 1,
  dimensions_locked boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE closet_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to closet_catalog"
  ON closet_catalog
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to closet_catalog"
  ON closet_catalog
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_closet_catalog_is_active ON closet_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_closet_catalog_evita_line ON closet_catalog(evita_line);

CREATE TABLE IF NOT EXISTS area_closet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES project_areas(id) ON DELETE CASCADE,
  closet_catalog_id uuid NOT NULL REFERENCES closet_catalog(id),
  quantity integer NOT NULL DEFAULT 1,
  with_backs boolean NOT NULL DEFAULT true,
  unit_price_usd numeric NOT NULL DEFAULT 0,
  unit_price_mxn numeric NOT NULL DEFAULT 0,
  hardware jsonb DEFAULT '[]'::jsonb,
  hardware_cost numeric NOT NULL DEFAULT 0,
  subtotal_mxn numeric NOT NULL DEFAULT 0,
  boxes_count integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE area_closet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to area_closet_items"
  ON area_closet_items
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to area_closet_items"
  ON area_closet_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_area_closet_items_area_id ON area_closet_items(area_id);
CREATE INDEX IF NOT EXISTS idx_area_closet_items_catalog_id ON area_closet_items(closet_catalog_id);
