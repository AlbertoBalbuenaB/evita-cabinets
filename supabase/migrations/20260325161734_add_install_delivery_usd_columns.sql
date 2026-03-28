/*
  # Switch Install & Delivery costs from MXN to USD

  ## Summary
  This migration adds new USD-denominated columns for install/delivery costs and
  safely migrates existing MXN values by dividing them by the current exchange rate.

  ## Changes

  ### New Columns on `projects`
  - `install_delivery_usd` (DECIMAL 10,4) — flat install & delivery amount in USD
  - `install_delivery_per_box_usd` (DECIMAL 10,4) — per-box rate in USD

  ## Data Migration Strategy
  - For projects where install_delivery > 0, convert to USD using the exchange rate
    stored in the settings table (exchange_rate_usd_to_mxn). If the setting is not
    found, falls back to 18.00 as the default exchange rate.
  - Projects with install_delivery = 0 remain at 0, no impact.

  ## Notes
  - The old `install_delivery` and `install_delivery_per_box` columns are left
    untouched to preserve a safe rollback path. The application will now read/write
    only the new `_usd` columns.
  - This completely eliminates the risk of existing MXN values being treated as USD
    and inflating project totals.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'install_delivery_usd'
  ) THEN
    ALTER TABLE projects ADD COLUMN install_delivery_usd DECIMAL(10,4) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'install_delivery_per_box_usd'
  ) THEN
    ALTER TABLE projects ADD COLUMN install_delivery_per_box_usd DECIMAL(10,4) DEFAULT 0;
  END IF;
END $$;

DO $$
DECLARE
  exchange_rate DECIMAL(10,2);
BEGIN
  SELECT COALESCE(
    (SELECT value::DECIMAL FROM settings WHERE key = 'exchange_rate_usd_to_mxn' LIMIT 1),
    18.00
  ) INTO exchange_rate;

  IF exchange_rate IS NULL OR exchange_rate = 0 THEN
    exchange_rate := 18.00;
  END IF;

  UPDATE projects
  SET install_delivery_usd = ROUND(install_delivery / exchange_rate, 4)
  WHERE install_delivery IS NOT NULL AND install_delivery > 0;

  UPDATE projects
  SET install_delivery_per_box_usd = ROUND(install_delivery_per_box / exchange_rate, 4)
  WHERE install_delivery_per_box IS NOT NULL AND install_delivery_per_box > 0;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_install_delivery_usd ON projects(install_delivery_usd);
