-- Remap old log_type values to new ones
UPDATE project_logs SET log_type = 'change'    WHERE log_type IN ('change_request', 'approved_change');
UPDATE project_logs SET log_type = 'issue'     WHERE log_type = 'error';
UPDATE project_logs SET log_type = 'milestone' WHERE log_type = 'achievement';
UPDATE project_logs SET log_type = 'note'      WHERE log_type NOT IN ('note', 'change', 'decision', 'issue', 'milestone');

-- Add CHECK constraint for valid types
ALTER TABLE project_logs
  ADD CONSTRAINT project_logs_log_type_check
  CHECK (log_type IN ('note','change','decision','risk','issue','milestone','update'));
