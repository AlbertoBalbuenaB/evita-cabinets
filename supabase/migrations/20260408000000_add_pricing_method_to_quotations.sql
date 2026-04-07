/*
  # Add pricing_method selector and optimizer-derived totals on quotations

  Additive only. The existing ft² flow keeps writing total_amount untouched.
  When pricing_method = 'optimizer', a parallel rollup writes optimizer_total_amount
  AND mirrors it into total_amount so all downstream consumers (PDF, dashboards)
  read the right number with no other code changes.
*/

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS pricing_method          TEXT NOT NULL DEFAULT 'sqft'
    CHECK (pricing_method IN ('sqft', 'optimizer')),
  ADD COLUMN IF NOT EXISTS active_optimizer_run_id UUID,
  ADD COLUMN IF NOT EXISTS optimizer_total_amount  DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS optimizer_is_stale      BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quotations_pricing_method ON quotations(pricing_method);
