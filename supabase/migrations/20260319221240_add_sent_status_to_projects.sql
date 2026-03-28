/*
  # Add 'Sent' to projects status constraint

  ## Summary
  The projects table has a CHECK constraint on the `status` column that was missing
  the 'Sent' value. This migration drops the old constraint and recreates it with
  all 7 valid status values.

  ## Changes
  - Drops existing `projects_status_check` constraint
  - Recreates it including 'Sent' alongside the existing values

  ## Valid Status Values After This Migration
  1. Pending
  2. Estimating
  3. Sent
  4. Lost
  5. Awarded
  6. Disqualified
  7. Cancelled
*/

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('Pending', 'Estimating', 'Sent', 'Lost', 'Awarded', 'Disqualified', 'Cancelled'));
