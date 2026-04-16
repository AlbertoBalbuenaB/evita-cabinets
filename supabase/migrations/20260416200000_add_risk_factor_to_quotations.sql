-- Add risk factor percentage to quotations
-- Applied via MCP apply_migration on 2026-04-16

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS risk_factor_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_factor_applies_sqft boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_factor_applies_optimizer boolean DEFAULT true;
