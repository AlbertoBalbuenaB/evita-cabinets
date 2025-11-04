/*
  # Fix area_cabinets UPDATE trigger issue
  
  ## Problem
  - Trigger `update_area_cabinets_updated_at` references non-existent `updated_at` column
  - This causes all UPDATE operations on area_cabinets to fail
  - Users cannot edit/save cabinet changes
  
  ## Solution
  - Drop the problematic trigger
  - This allows UPDATE operations to work correctly
  
  ## Impact
  - Fixes cabinet editing functionality
  - No data loss
  - No breaking changes
*/

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS update_area_cabinets_updated_at ON area_cabinets;
