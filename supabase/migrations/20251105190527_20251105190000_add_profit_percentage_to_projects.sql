/*
  # Add profit percentage to projects

  1. Changes
    - Add `profit_percentage` column to `projects` table
    - Default value is 0 (no profit)
    - Column is nullable for backwards compatibility

  2. Notes
    - Profit percentage is applied to the subtotal before taxes
    - Similar to tariff_percentage in functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'profit_percentage'
  ) THEN
    ALTER TABLE projects ADD COLUMN profit_percentage numeric DEFAULT 0;
  END IF;
END $$;