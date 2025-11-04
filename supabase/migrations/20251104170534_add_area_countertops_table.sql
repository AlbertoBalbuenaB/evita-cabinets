/*
  # Add Area Countertops Table

  1. New Tables
    - `area_countertops`: Stores countertop items added to project areas
      - `id` (uuid, primary key)
      - `area_id` (uuid, foreign key to project_areas)
      - `price_list_item_id` (uuid, foreign key to price_list)
      - `item_name` (text): Name/description of the countertop
      - `quantity` (decimal): Quantity of countertops (supports decimals for sq ft, meters, etc.)
      - `unit_price` (decimal): Price per unit (with tax if applicable)
      - `subtotal` (decimal): Calculated total (quantity × unit_price)
      - `notes` (text, nullable): Optional notes about the countertop
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `version_area_countertops`: Stores countertop snapshots for project versions
      - Same structure as area_countertops but with version_id
      - Used for version history and comparison

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (matching existing area_items pattern)

  3. Indexes
    - Index on area_id for fast lookups
    - Index on price_list_item_id for reference
    - Index on version_id for version queries

  4. Integration
    - Countertops work identically to area_items
    - Only difference: filtered to countertop types (Quartz, Granite, Marble, Solid Surface, Plastic Laminate)
    - Contributes to area and project totals via existing triggers

  5. Notes
    - Countertops are independent from cabinets and items
    - Each countertop stores its price at the time of addition
    - Countertops contribute to area and project totals
    - Supports decimal quantities for accurate measurements
*/

CREATE TABLE IF NOT EXISTS area_countertops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES project_areas(id) ON DELETE CASCADE,
  price_list_item_id UUID NOT NULL REFERENCES price_list(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_countertops_area_id ON area_countertops(area_id);
CREATE INDEX IF NOT EXISTS idx_area_countertops_price_list_item_id ON area_countertops(price_list_item_id);

ALTER TABLE area_countertops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to area_countertops"
  ON area_countertops FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to area_countertops"
  ON area_countertops FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to area_countertops"
  ON area_countertops FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to area_countertops"
  ON area_countertops FOR DELETE
  TO public
  USING (true);

CREATE TABLE IF NOT EXISTS version_area_countertops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  area_id UUID NOT NULL,
  price_list_item_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_area_countertops_version_id ON version_area_countertops(version_id);
CREATE INDEX IF NOT EXISTS idx_version_area_countertops_area_id ON version_area_countertops(area_id);

ALTER TABLE version_area_countertops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to version_area_countertops"
  ON version_area_countertops FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to version_area_countertops"
  ON version_area_countertops FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to version_area_countertops"
  ON version_area_countertops FOR DELETE
  TO public
  USING (true);
