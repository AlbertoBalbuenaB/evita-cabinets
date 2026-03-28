/*
  # Add Other Expenses Label to Projects

  1. Changes
    - Adds `other_expenses_label` (text) column to the `projects` table
    - Default value is 'Other Expenses' so all existing records retain the original label
    - This allows each project to have a custom label for the other expenses line item

  2. Notes
    - No data migration needed; default covers existing rows
    - Column is nullable; app code falls back to 'Other Expenses' when null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'other_expenses_label'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN other_expenses_label TEXT DEFAULT 'Other Expenses';
  END IF;
END $$;
