/*
  # Fix project_versions table - Add updated_at column

  ## Problem
  The `update_updated_at_column()` trigger tries to update `updated_at` column
  but it doesn't exist in the `project_versions` table, causing failures when
  updating versions (e.g., setting current version).

  ## Solution
  Add the missing `updated_at` column to `project_versions` table.

  ## Changes
  1. Add `updated_at` column with default NOW()
  2. Create index for performance
  3. Backfill existing records with created_at value

  ## Security Notes
  - Column is automatically managed by trigger
  - No RLS changes needed
  - Maintains data consistency
*/

-- Add updated_at column to project_versions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_versions'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE project_versions 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Backfill with created_at for existing records
    UPDATE project_versions 
    SET updated_at = created_at 
    WHERE updated_at IS NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_project_versions_updated 
    ON project_versions(updated_at DESC);
    
    RAISE NOTICE 'Added updated_at column to project_versions table';
  ELSE
    RAISE NOTICE 'updated_at column already exists in project_versions table';
  END IF;
END $$;
