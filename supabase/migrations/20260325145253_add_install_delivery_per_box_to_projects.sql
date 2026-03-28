/*
  # Add install_delivery_per_box to projects table

  ## Summary
  Adds a new column to store the per-box rate (in MXN) used to automatically
  calculate the Design Services, Install & Delivery flat amount.

  ## New Columns
  - `projects.install_delivery_per_box` (DECIMAL 10,2, default 0)
    Stores the MXN amount per box. When set, the flat amount (install_delivery)
    is automatically calculated as: install_delivery_per_box × total_project_boxes.
    A value of 0 means the user is entering the flat amount manually.

  ## Notes
  - Non-destructive addition only
  - Default is 0 (no per-box rate, manual flat amount mode)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'install_delivery_per_box'
  ) THEN
    ALTER TABLE projects ADD COLUMN install_delivery_per_box DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;
