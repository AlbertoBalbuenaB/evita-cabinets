/*
  # Add Project Type to Projects

  1. Changes
    - Add `project_type` column to `projects` table
      - Type: text with check constraint
      - Allowed values: 'Custom', 'Bids', 'Prefab', 'Stores'
      - Default: 'Custom'
      - Not null
  
  2. Notes
    - Uses check constraint to ensure only valid project types
    - Adds index for performance on filtering by project_type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_type'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN project_type text NOT NULL DEFAULT 'Custom'
    CHECK (project_type IN ('Custom', 'Bids', 'Prefab', 'Stores'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
