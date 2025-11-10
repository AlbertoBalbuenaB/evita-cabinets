/*
  # Change tax_multiplier to tax_percentage

  1. Changes
    - Rename tax_multiplier column to tax_percentage
    - Update comment to reflect percentage (e.g., 8.25 for 8.25%)
    - Keep default value at 0

  2. Notes
    - Users will now enter percentages (e.g., 8.25) instead of decimals (0.0825)
    - The application will convert to multiplier in calculations by dividing by 100
    - This avoids precision issues with small decimal values
*/

-- Rename tax_multiplier to tax_percentage
ALTER TABLE projects 
  RENAME COLUMN tax_multiplier TO tax_percentage;

-- Update the comment to clarify it's a percentage
COMMENT ON COLUMN projects.tax_percentage IS 'Tax percentage (e.g., 8.25 for 8.25% tax)';