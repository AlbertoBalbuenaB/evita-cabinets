/*
  # Add PDF Override Columns to Projects

  ## Summary
  Adds 4 nullable text columns to the `projects` table that allow users to
  customize values shown in PDF output without modifying their original project data.

  ## New Columns
  - `pdf_project_name` (text, nullable) - Override for project name in PDFs
  - `pdf_customer` (text, nullable) - Override for customer name in PDFs
  - `pdf_address` (text, nullable) - Override for address in PDFs
  - `pdf_project_brief` (text, nullable) - Override for project brief/details in PDFs (pre-filtered version)

  ## Behavior
  - NULL = use original project field value (default behavior, backward compatible)
  - Non-null = use this override value in PDF output only

  ## Notes
  - No RLS changes needed; these columns inherit the existing `projects` table policies
  - Fully backward compatible: existing projects with no overrides behave exactly as before
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'pdf_project_name'
  ) THEN
    ALTER TABLE projects ADD COLUMN pdf_project_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'pdf_customer'
  ) THEN
    ALTER TABLE projects ADD COLUMN pdf_customer text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'pdf_address'
  ) THEN
    ALTER TABLE projects ADD COLUMN pdf_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'pdf_project_brief'
  ) THEN
    ALTER TABLE projects ADD COLUMN pdf_project_brief text;
  END IF;
END $$;
