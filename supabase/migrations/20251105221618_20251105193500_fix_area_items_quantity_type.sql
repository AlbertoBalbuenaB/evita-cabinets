/*
  # Fix area_items quantity field type

  1. Changes
    - Change `quantity` column from integer to numeric in `area_items` table
    - This allows decimal quantities like 56.75

  2. Notes
    - Some items may need fractional quantities (e.g., linear feet, square feet)
    - This fixes the error "invalid input syntax for type integer: '56.75'"
*/

ALTER TABLE area_items 
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;