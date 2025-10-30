/*
  # Add Accessories Labor Cost Setting

  1. Changes
    - Insert new setting `labor_cost_accessories` with default value of 100.00
    - This setting controls the labor cost applied to 460: Accessories products
  
  2. Purpose
    - Allow configuration of labor costs specifically for accessories
    - Separate from cabinet labor costs (with/without drawers)
    - Default value: $100.00 MXN
*/

INSERT INTO settings (key, value, description, category)
VALUES (
  'labor_cost_accessories',
  '100',
  'Labor cost for 460: Accessories products (MXN)',
  'labor'
)
ON CONFLICT (key) DO NOTHING;
