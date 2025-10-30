/*
  # Add Taxes Configuration System

  1. New Tables
    - `taxes_by_type`: Stores tax percentages per material type
      - `id` (uuid, primary key)
      - `material_type` (text): The material type (e.g., "Metal", "Fabric")
      - `tax_percentage` (decimal): Tax percentage to apply
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `custom_types`: Stores custom types for price list
      - `id` (uuid, primary key)
      - `type_name` (text, unique): The custom type name
      - `created_at` (timestamp)
    
    - `custom_units`: Stores custom units for price list
      - `id` (uuid, primary key)
      - `unit_name` (text, unique): The custom unit name
      - `created_at` (timestamp)

  2. Changes to price_list
    - Add `tax_rate` (decimal): The tax rate applied to this item based on its type
    - Add `base_price` (decimal): Original price before taxes
    - Add `price_with_tax` (decimal): Price including taxes (calculated field)

  3. Security
    - Enable RLS on all new tables
    - Add policies for public access (can be restricted later)

  4. Notes
    - Taxes are applied automatically based on material type
    - Base price stores original cost, price_with_tax is used in calculations
    - Custom types and units allow expanding the price list categories
*/

-- Create taxes_by_type table
CREATE TABLE IF NOT EXISTS taxes_by_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_type TEXT UNIQUE NOT NULL,
  tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxes_by_type_material ON taxes_by_type(material_type);

ALTER TABLE taxes_by_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to taxes_by_type"
  ON taxes_by_type FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to taxes_by_type"
  ON taxes_by_type FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to taxes_by_type"
  ON taxes_by_type FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to taxes_by_type"
  ON taxes_by_type FOR DELETE
  TO public
  USING (true);

-- Create custom_types table
CREATE TABLE IF NOT EXISTS custom_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_types_name ON custom_types(type_name);

ALTER TABLE custom_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to custom_types"
  ON custom_types FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to custom_types"
  ON custom_types FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to custom_types"
  ON custom_types FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to custom_types"
  ON custom_types FOR DELETE
  TO public
  USING (true);

-- Create custom_units table
CREATE TABLE IF NOT EXISTS custom_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_units_name ON custom_units(unit_name);

ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to custom_units"
  ON custom_units FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to custom_units"
  ON custom_units FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to custom_units"
  ON custom_units FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to custom_units"
  ON custom_units FOR DELETE
  TO public
  USING (true);

-- Add tax-related columns to price_list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE price_list 
    ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'base_price'
  ) THEN
    ALTER TABLE price_list 
    ADD COLUMN base_price DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'price_with_tax'
  ) THEN
    ALTER TABLE price_list 
    ADD COLUMN price_with_tax DECIMAL(10,2);
  END IF;
END $$;

-- Copy existing prices to base_price and price_with_tax if they're null
UPDATE price_list 
SET base_price = price, price_with_tax = price
WHERE base_price IS NULL OR price_with_tax IS NULL;

-- Insert default tax configurations
INSERT INTO taxes_by_type (material_type, tax_percentage)
VALUES 
  ('Metal', 25.00),
  ('Fabric', 25.00)
ON CONFLICT (material_type) DO NOTHING;

-- Insert common types
INSERT INTO custom_types (type_name)
VALUES 
  ('Melamine'),
  ('Edgeband'),
  ('Hardware'),
  ('Hinges'),
  ('Handles'),
  ('Drawer Slides'),
  ('Interior Finish'),
  ('Accessories')
ON CONFLICT (type_name) DO NOTHING;

-- Insert common units
INSERT INTO custom_units (unit_name)
VALUES 
  ('Sheet'),
  ('Meter'),
  ('Piece'),
  ('Set'),
  ('Box'),
  ('Roll')
ON CONFLICT (unit_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_price_list_tax_rate ON price_list(tax_rate);
CREATE INDEX IF NOT EXISTS idx_price_list_base_price ON price_list(base_price);
CREATE INDEX IF NOT EXISTS idx_price_list_price_with_tax ON price_list(price_with_tax);
