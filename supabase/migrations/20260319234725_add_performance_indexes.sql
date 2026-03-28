/*
  # Add Performance Indexes

  ## Purpose
  Add missing indexes on project_id columns for tables frequently queried by
  project scope. Reduces full table scans when loading project management data.

  ## Findings
  - area_cabinets, area_items, area_countertops: have no project_id column —
    they are accessed via area_id which already has indexes. No action needed.
  - project_areas: already has idx_areas_order on project_id. No action needed.
  - project_tasks: already has idx_project_tasks_project_id. No action needed.
  - project_documents: already has idx_project_documents_project_id. No action needed.

  ## New Indexes
  - project_activities.project_id — speeds up schedule/activity queries per project
  - project_logs.project_id — speeds up bitacora/log queries per project

  ## Notes
  - All indexes use IF NOT EXISTS for safe, idempotent execution
  - No data is modified — only index structures are added
*/

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id
  ON project_activities (project_id);

CREATE INDEX IF NOT EXISTS idx_project_logs_project_id
  ON project_logs (project_id);
