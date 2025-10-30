/*
  # Add Area Items Table

  1. New Table
    - `area_items`: Stores individual price list items added to project areas
      - `id` (uuid, primary key)
      - `area_id` (uuid, foreign key to project_areas)
      - `price_list_item_id` (uuid, foreign key to price_list)
      - `item_name` (text): Name/description of the item
      - `quantity` (integer): Quantity of items
      - `unit_price` (decimal): Price per unit (with tax if applicable)
      - `subtotal` (decimal): Calculated total (quantity × unit_price)
      - `notes` (text, nullable): Optional notes about the item
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on area_items table
    - Add policies for public access to read/write

  3. Indexes
    - Index on area_id for fast lookups
    - Index on price_list_item_id for reference

  4. Notes
    - Items are independent from cabinets
    - Each item stores its price at the time of addition
    - Items contribute to area and project totals
*/

CREATE TABLE IF NOT EXISTS area_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES project_areas(id) ON DELETE CASCADE,
  price_list_item_id UUID NOT NULL REFERENCES price_list(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_items_area_id ON area_items(area_id);
CREATE INDEX IF NOT EXISTS idx_area_items_price_list_item_id ON area_items(price_list_item_id);

ALTER TABLE area_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to area_items"
  ON area_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to area_items"
  ON area_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to area_items"
  ON area_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to area_items"
  ON area_items FOR DELETE
  TO public
  USING (true);
