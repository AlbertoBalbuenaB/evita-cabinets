-- Add log_type and updated_at columns to project_logs
ALTER TABLE project_logs
  ADD COLUMN IF NOT EXISTS log_type VARCHAR(50) NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
