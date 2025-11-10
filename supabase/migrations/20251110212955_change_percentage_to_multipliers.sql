-- Migration: Change percentage columns to multipliers
-- Changes tariff_percentage to tariff_multiplier
-- Changes profit_percentage to profit_multiplier  
-- Changes taxes_percentage to tax_multiplier

-- Rename columns to reflect they are now multipliers, not percentages
ALTER TABLE projects 
  RENAME COLUMN tariff_percentage TO tariff_multiplier;

ALTER TABLE projects 
  RENAME COLUMN profit_percentage TO profit_multiplier;

ALTER TABLE projects 
  RENAME COLUMN taxes_percentage TO tax_multiplier;

-- Update the default values to 0 (no multiplier effect by default)
ALTER TABLE projects 
  ALTER COLUMN tariff_multiplier SET DEFAULT 0;

ALTER TABLE projects 
  ALTER COLUMN profit_multiplier SET DEFAULT 0;

ALTER TABLE projects 
  ALTER COLUMN tax_multiplier SET DEFAULT 0;

-- Add comments to clarify the new behavior
COMMENT ON COLUMN projects.tariff_multiplier IS 'Multiplier for tariff calculation (e.g., 0.11 for 11%)';
COMMENT ON COLUMN projects.profit_multiplier IS 'Multiplier for profit calculation (e.g., 0.5 for 50%)';
COMMENT ON COLUMN projects.tax_multiplier IS 'Multiplier for tax calculation (e.g., 0.0825 for 8.25%)';
