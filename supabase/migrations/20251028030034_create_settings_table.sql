/*
  # Create Settings Table

  1. New Tables
    - `settings`
      - `id` (uuid, primary key) - Unique identifier
      - `key` (text, unique) - Setting key (e.g., 'labor_cost_no_drawers', 'waste_percentage_box')
      - `value` (text) - Setting value stored as text (will be parsed as needed)
      - `description` (text) - Human-readable description of the setting
      - `data_type` (text) - Type of data (number, percentage, boolean, text)
      - `category` (text) - Category for grouping settings (labor, waste, general)
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update
  
  2. Security
    - Enable RLS on `settings` table
    - Add policy for authenticated users to read settings
    - Add policy for authenticated users to update settings

  3. Default Settings
    - Labor cost for cabinets without drawers: $400
    - Labor cost for cabinets with drawers: $600
    - Waste percentage for box materials: 10%
    - Waste percentage for doors/fronts materials: 10%
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text NOT NULL,
  data_type text NOT NULL DEFAULT 'number',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update settings"
  ON settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO settings (key, value, description, data_type, category) VALUES
  ('labor_cost_no_drawers', '400', 'Labor cost per cabinet without drawers (MXN)', 'number', 'labor'),
  ('labor_cost_with_drawers', '600', 'Labor cost per cabinet with drawers (MXN)', 'number', 'labor'),
  ('waste_percentage_box', '10', 'Waste percentage for box materials (%)', 'percentage', 'waste'),
  ('waste_percentage_doors', '10', 'Waste percentage for doors and drawer fronts (%)', 'percentage', 'waste')
ON CONFLICT (key) DO NOTHING;
