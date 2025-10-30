/*
  # Add Project Details Field

  1. Changes
    - Add `project_details` column to `projects` table
      - Type: text (allows up to ~1GB, but we'll enforce 5000 chars in frontend)
      - Default: NULL (optional field)
      - Purpose: Store detailed description and notes about the project

  2. Features
    - Optional field - projects can have NULL or empty details
    - No length constraint at DB level (handled by frontend validation)
    - Indexed for text search capabilities

  3. Notes
    - Field is optional to maintain compatibility with existing projects
    - Frontend will enforce 5000 character limit
    - Can store multi-line text, formatted descriptions, specifications, etc.
*/

-- Add project_details column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_details'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN project_details TEXT DEFAULT NULL;
  END IF;
END $$;

-- Add index for text search on project_details
CREATE INDEX IF NOT EXISTS idx_projects_details
  ON projects USING gin(to_tsvector('english', COALESCE(project_details, '')));

-- Add comment to document the column
COMMENT ON COLUMN projects.project_details IS 'Detailed description and notes about the project. Optional field with frontend validation of max 5000 characters.';