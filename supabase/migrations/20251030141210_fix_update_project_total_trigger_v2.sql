/*
  # Fix update_project_total_from_version trigger (v2)

  ## Problem
  The trigger tries to update projects.total but the column name is total_amount.

  ## Solution
  Fix the trigger to use the correct column name in projects table.

  ## Changes
  1. Update trigger to set projects.total_amount from version.total_amount
  2. Ensure proper column mapping

  ## Security Notes
  - SECURITY DEFINER maintained
  - search_path secured
  - Column name corrected
*/

-- Drop and recreate with correct column name for projects table
DROP FUNCTION IF EXISTS update_project_total_from_version() CASCADE;

CREATE OR REPLACE FUNCTION public.update_project_total_from_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.projects
    SET total_amount = NEW.total_amount
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_project_total_trigger ON project_versions;
CREATE TRIGGER update_project_total_trigger
  AFTER INSERT OR UPDATE ON project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_total_from_version();
