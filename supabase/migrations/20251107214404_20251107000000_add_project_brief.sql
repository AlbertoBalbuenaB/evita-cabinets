/*
  # Add Project Brief Column

  ## Overview
  Adds a project_brief column to store auto-generated project summaries
  including box construction, finishes, hardware, and cabinet types.

  ## Changes

  ### 1. Add Column
  - Add project_brief column to projects table
  - This will store auto-generated summaries of project details

  ## Notes
  - The brief is auto-generated when user saves project changes
  - Contains: Box construction materials, Finishes, Hardware (grouped by category), Cabinet types with quantities
*/

-- Add project_brief column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_brief text;

COMMENT ON COLUMN projects.project_brief IS 'Auto-generated project summary including materials, finishes, hardware, and cabinet types';
