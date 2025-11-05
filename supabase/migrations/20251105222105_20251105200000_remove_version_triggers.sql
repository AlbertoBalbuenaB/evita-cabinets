/*
  # Remove version system triggers

  1. Changes
    - Drop trigger `trigger_auto_create_initial_version` from projects table
    - Drop function `auto_create_initial_version()` if it exists
    - These were trying to create entries in the deleted project_versions table

  2. Notes
    - This fixes the error "relation 'project_versions' does not exist" when creating projects
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_initial_version ON projects;

-- Drop the function
DROP FUNCTION IF EXISTS auto_create_initial_version() CASCADE;