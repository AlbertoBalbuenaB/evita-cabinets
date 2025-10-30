/*
  # Add RTA field to Area Cabinets

  1. Changes
    - Add `is_rta` column to `area_cabinets` table
      - Type: boolean
      - Default: true (most cabinets are RTA by default)
      - Not null
  
  2. Notes
    - RTA (Ready To Assemble) affects pallet calculations
    - RTA cabinets: divide by 19 for pallets
    - Non-RTA cabinets: divide by 5.8 for pallets
    - Default is true, but cabinets with drawers should be false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'area_cabinets' AND column_name = 'is_rta'
  ) THEN
    ALTER TABLE area_cabinets 
    ADD COLUMN is_rta boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_area_cabinets_is_rta ON area_cabinets(is_rta);
