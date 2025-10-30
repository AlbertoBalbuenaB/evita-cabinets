/*
  # Update Project Status Values

  1. Changes
    - Update status column to use new values
    - New statuses: Pending, Estimating, Lost, Awarded, Disqualified, Cancelled
    - Old statuses: draft, in_progress, approved, completed

  2. Migration Strategy
    - Map old values to new values:
      - draft → Pending
      - in_progress → Estimating
      - approved → Awarded
      - completed → Awarded
    - Add check constraint for new status values

  3. Notes
    - Existing data will be automatically converted
    - New constraint ensures only valid statuses
    - Status values are now capitalized for consistency
*/

-- First, update existing data to new status values
UPDATE projects
SET status = CASE
  WHEN status = 'draft' THEN 'Pending'
  WHEN status = 'in_progress' THEN 'Estimating'
  WHEN status = 'approved' THEN 'Awarded'
  WHEN status = 'completed' THEN 'Awarded'
  ELSE status
END
WHERE status IN ('draft', 'in_progress', 'approved', 'completed');

-- Drop existing check constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_status_check;
  END IF;
END $$;

-- Add new check constraint with updated status values
ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('Pending', 'Estimating', 'Lost', 'Awarded', 'Disqualified', 'Cancelled'));

-- Add comment to document the status values
COMMENT ON COLUMN projects.status IS 'Project status: Pending (new), Estimating (in progress), Lost (not won), Awarded (won), Disqualified (not qualified), Cancelled (cancelled)';
