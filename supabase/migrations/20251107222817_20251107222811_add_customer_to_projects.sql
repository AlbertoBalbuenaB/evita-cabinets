/*
  # Add customer field to projects

  1. Changes
    - Add `customer` column to projects table to identify the customer/client for each project
    - This field is optional and allows filtering projects by customer

  2. Notes
    - The customer field stores the customer/client name as text
    - Existing projects will have NULL customer values
*/

-- Add customer column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer TEXT;

-- Add index for better query performance when filtering by customer
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer);
