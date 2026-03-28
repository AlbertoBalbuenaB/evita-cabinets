/*
  # Add Unique Constraint to project_documents

  ## Summary
  Prevents duplicate seed entries in the project_documents table by adding a
  unique constraint on (project_id, label). This ensures that calling the
  seed/upsert logic multiple times will not create duplicate rows.

  ## Changes
  - Removes existing duplicate rows (keeps earliest per project_id + label)
  - Adds UNIQUE constraint on (project_id, label)
*/

-- Remove duplicate rows keeping the earliest created row per (project_id, label)
DELETE FROM project_documents
WHERE id NOT IN (
  SELECT DISTINCT ON (project_id, label) id
  FROM project_documents
  ORDER BY project_id, label, created_at ASC
);

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'project_documents'
    AND constraint_name = 'project_documents_project_id_label_unique'
  ) THEN
    ALTER TABLE project_documents
      ADD CONSTRAINT project_documents_project_id_label_unique
      UNIQUE (project_id, label);
  END IF;
END $$;
