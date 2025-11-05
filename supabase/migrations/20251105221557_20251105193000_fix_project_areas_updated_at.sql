/*
  # Fix project_areas table updated_at column

  1. Changes
    - Add missing `updated_at` column to `project_areas` table
    - The trigger already exists and expects this column

  2. Notes
    - This fixes the error "record 'new' has no field 'updated_at'"
    - The update trigger is already in place, we just need the column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_areas' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE project_areas ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;