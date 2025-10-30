/*
  # Fix update_project_total_from_version trigger

  ## Problem
  The trigger tries to access NEW.total but the column name is total_amount,
  causing errors when updating versions.

  ## Solution
  Fix the trigger to use the correct column name (total_amount).

  ## Changes
  1. Drop and recreate the trigger function with correct column reference
  2. Ensure projects table total is updated from version's total_amount

  ## Security Notes
  - SECURITY DEFINER maintained for proper permissions
  - search_path set for security
  - No data loss
*/

-- Drop and recreate the function with correct column name
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
    SET total = NEW.total_amount
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
