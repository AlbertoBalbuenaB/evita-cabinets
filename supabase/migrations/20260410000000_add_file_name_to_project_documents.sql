ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS file_name text;

COMMENT ON COLUMN project_documents.file_name IS
  'Original filename from Google Drive Picker (or other source). Null when the URL was pasted manually.';
