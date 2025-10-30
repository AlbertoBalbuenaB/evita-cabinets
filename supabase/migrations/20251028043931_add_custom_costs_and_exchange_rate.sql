/*
  # Add Custom Costs and Exchange Rate

  1. Changes to Projects Table
    - Add `other_expenses` (decimal): Custom additional expenses
    - Add `taxes_percentage` (decimal): Tax percentage to apply to project total
    - Add `install_delivery` (decimal): Installation and delivery cost
  
  2. Changes to Settings Table
    - Add `exchange_rate_usd_to_mxn` (decimal): Exchange rate from USD to MXN, default 18.00
  
  3. Notes
    - Other expenses: flat amount added to total
    - Taxes: percentage applied to subtotal (before taxes)
    - Install and delivery: flat amount added to total
    - All custom costs are optional (can be null or 0)
    - Exchange rate default is $18.00 MXN per $1.00 USD
*/

-- Add custom costs to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'other_expenses'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN other_expenses DECIMAL(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'taxes_percentage'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN taxes_percentage DECIMAL(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'install_delivery'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN install_delivery DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add exchange rate to settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'exchange_rate_usd_to_mxn'
  ) THEN
    ALTER TABLE settings 
    ADD COLUMN exchange_rate_usd_to_mxn DECIMAL(10,2) NOT NULL DEFAULT 18.00;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_other_expenses ON projects(other_expenses);
CREATE INDEX IF NOT EXISTS idx_projects_taxes_percentage ON projects(taxes_percentage);
CREATE INDEX IF NOT EXISTS idx_projects_install_delivery ON projects(install_delivery);
