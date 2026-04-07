/*
  # Create quotation_optimizer_runs table

  Stores frozen optimizer "runs" (versions) per quotation. Each run holds a
  snapshot of the input pieces/stocks/eb config and the engine result, plus
  denormalized KPIs for fast list views and analytics. The active run drives
  the optimizer pricing total when quotations.pricing_method = 'optimizer'.
*/

CREATE TABLE IF NOT EXISTS quotation_optimizer_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Run',
  is_active       BOOLEAN NOT NULL DEFAULT false,
  is_stale        BOOLEAN NOT NULL DEFAULT false,

  -- KPIs (denormalized for analytics list view)
  total_cost      DECIMAL(14,4) NOT NULL DEFAULT 0,
  material_cost   DECIMAL(14,4) NOT NULL DEFAULT 0,
  edgeband_cost   DECIMAL(14,4) NOT NULL DEFAULT 0,
  waste_pct       DECIMAL(6,3)  NOT NULL DEFAULT 0,
  board_count     INTEGER       NOT NULL DEFAULT 0,
  total_piece_m2  DECIMAL(12,4) NOT NULL DEFAULT 0,
  cost_per_m2     DECIMAL(12,4) NOT NULL DEFAULT 0,

  -- Frozen snapshot (pieces, stocks, eb config, settings, attributions, warnings)
  snapshot        JSONB NOT NULL,

  -- Engine result (BoardResult[] etc.) — used to render UI without re-running
  result          JSONB NOT NULL,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK from quotations.active_optimizer_run_id to quotation_optimizer_runs.id
ALTER TABLE quotations
  ADD CONSTRAINT quotations_active_optimizer_run_fk
  FOREIGN KEY (active_optimizer_run_id)
  REFERENCES quotation_optimizer_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qor_quotation         ON quotation_optimizer_runs(quotation_id);
CREATE INDEX IF NOT EXISTS idx_qor_quotation_active  ON quotation_optimizer_runs(quotation_id, is_active);

-- Enforce single active run per quotation
CREATE UNIQUE INDEX IF NOT EXISTS uniq_qor_active_per_quotation
  ON quotation_optimizer_runs(quotation_id) WHERE is_active = true;

-- updated_at trigger
DROP TRIGGER IF EXISTS update_qor_updated_at ON quotation_optimizer_runs;
CREATE TRIGGER update_qor_updated_at
  BEFORE UPDATE ON quotation_optimizer_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (matches existing pattern from other recent migrations)
ALTER TABLE quotation_optimizer_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on quotation_optimizer_runs"
  ON quotation_optimizer_runs FOR ALL
  USING (true) WITH CHECK (true);

-- =====================================================
-- Auto-mark optimizer runs stale on cabinet edits (D5)
-- Any insert/update/delete on area_cabinets flips the active run's is_stale
-- and the quotation's optimizer_is_stale flag. Manual re-run by the user.
-- =====================================================
CREATE OR REPLACE FUNCTION mark_optimizer_runs_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quotation_id UUID;
BEGIN
  SELECT project_id INTO v_quotation_id
  FROM project_areas
  WHERE id = COALESCE(NEW.area_id, OLD.area_id);

  IF v_quotation_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE quotation_optimizer_runs
     SET is_stale = true
   WHERE quotation_id = v_quotation_id
     AND is_active = true;

  UPDATE quotations
     SET optimizer_is_stale = true
   WHERE id = v_quotation_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_area_cabinets_stale_optimizer ON area_cabinets;
CREATE TRIGGER trg_area_cabinets_stale_optimizer
  AFTER INSERT OR UPDATE OR DELETE ON area_cabinets
  FOR EACH ROW EXECUTE FUNCTION mark_optimizer_runs_stale();
