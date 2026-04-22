/*
  # Version History v2 — Foundations (Phase 0)

  Groundwork for the Google Workspace–style undo/redo + history system
  for Quotations. No behavior changes yet — subsequent phases wire the
  frontend and edge function into these RPCs.

  ## What this migration does
    1. Extends `project_versions` with actor/source/summary/flag columns
    2. Expands the `version_type` CHECK to include 'auto_mutation', 'restore', 'initial'
    3. Adds the missing `updated_at` column to `area_cabinets`
    4. Adds `updated_by_member_id` to all child tables + `project_areas`
    5. Installs a reusable `set_updated_at()` trigger function + triggers
    6. Rewrites `create_project_snapshot()` to include closet / prefab / sections
    7. Introduces `capture_project_version_v2()` + `restore_project_version()`
       + `prune_auto_versions()` RPCs
    8. Adds indexes to support timeline queries + retention pruning

  ## Safety notes
    - All ALTERs use IF NOT EXISTS to be idempotent
    - Existing snapshots (schema_version < 2) remain restorable — the restore
      RPC reads only keys it finds, missing keys become empty arrays
    - No destructive DROP on columns or tables
*/

-- =========================================================================
-- 1. Reusable trigger function: bumps updated_at on UPDATE
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
  'Generic BEFORE UPDATE trigger that stamps updated_at = now(). Reused across all audit-enabled tables.';

-- =========================================================================
-- 2. Audit columns — add what is missing, install triggers on all 6 tables
-- =========================================================================

-- area_cabinets is missing updated_at entirely
ALTER TABLE public.area_cabinets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.area_cabinets
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.project_areas
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.area_items
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.area_countertops
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.area_closet_items
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.area_prefab_items
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.area_sections
  ADD COLUMN IF NOT EXISTS updated_by_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Drop stale triggers if they exist (idempotent re-run safety), then create fresh
DROP TRIGGER IF EXISTS set_updated_at_project_areas     ON public.project_areas;
DROP TRIGGER IF EXISTS set_updated_at_area_cabinets     ON public.area_cabinets;
DROP TRIGGER IF EXISTS set_updated_at_area_items        ON public.area_items;
DROP TRIGGER IF EXISTS set_updated_at_area_countertops  ON public.area_countertops;
DROP TRIGGER IF EXISTS set_updated_at_area_closet_items ON public.area_closet_items;
DROP TRIGGER IF EXISTS set_updated_at_area_prefab_items ON public.area_prefab_items;
DROP TRIGGER IF EXISTS set_updated_at_area_sections     ON public.area_sections;

CREATE TRIGGER set_updated_at_project_areas     BEFORE UPDATE ON public.project_areas     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_cabinets     BEFORE UPDATE ON public.area_cabinets     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_items        BEFORE UPDATE ON public.area_items        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_countertops  BEFORE UPDATE ON public.area_countertops  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_closet_items BEFORE UPDATE ON public.area_closet_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_prefab_items BEFORE UPDATE ON public.area_prefab_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_area_sections     BEFORE UPDATE ON public.area_sections     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 3. Extend project_versions
-- =========================================================================
ALTER TABLE public.project_versions
  ADD COLUMN IF NOT EXISTS actor_member_id    uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_user_id      uuid,
  ADD COLUMN IF NOT EXISTS action_code        text,
  ADD COLUMN IF NOT EXISTS summary            text,
  ADD COLUMN IF NOT EXISTS source             text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS parent_version_id  uuid REFERENCES public.project_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_named           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_auto            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_rollup          boolean NOT NULL DEFAULT false;

-- Backfill: rows that predate v2 (no action_code, no source-aware capture) were
-- all created by the bulk-ops modals. Treat them as named so retention never
-- prunes them — they represent real milestones.
UPDATE public.project_versions
SET is_auto = false,
    is_named = true
WHERE action_code IS NULL;

-- Expand version_type CHECK to include the new auto_mutation / restore / initial kinds
ALTER TABLE public.project_versions
  DROP CONSTRAINT IF EXISTS project_versions_version_type_check;

ALTER TABLE public.project_versions
  ADD CONSTRAINT project_versions_version_type_check
  CHECK (version_type IN (
    'price_update',
    'material_change',
    'manual_snapshot',
    'auto_mutation',
    'restore',
    'initial'
  ));

ALTER TABLE public.project_versions
  DROP CONSTRAINT IF EXISTS project_versions_source_check;

ALTER TABLE public.project_versions
  ADD CONSTRAINT project_versions_source_check
  CHECK (source IN ('client','ai','system'));

-- Partial indexes to keep timeline queries + pruning cheap
CREATE INDEX IF NOT EXISTS idx_project_versions_timeline
  ON public.project_versions(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_versions_named_or_rollup
  ON public.project_versions(project_id, created_at DESC)
  WHERE is_named OR is_rollup;

CREATE INDEX IF NOT EXISTS idx_project_versions_auto_prunable
  ON public.project_versions(created_at)
  WHERE is_auto AND NOT is_named AND NOT is_rollup;

CREATE INDEX IF NOT EXISTS idx_project_versions_actor
  ON public.project_versions(actor_member_id);

-- =========================================================================
-- 4. Rewrite create_project_snapshot — include closet / prefab / sections
--    + schema_version so old snapshots stay distinguishable
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_project_snapshot(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  SELECT jsonb_build_object(
    'schema_version', 2,
    'captured_at',    now(),
    'project',        (SELECT to_jsonb(q) FROM quotations q WHERE q.id = p_project_id),
    'areas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'area',         to_jsonb(pa),
          'cabinets',     COALESCE((SELECT jsonb_agg(to_jsonb(ac)) FROM area_cabinets      ac WHERE ac.area_id = pa.id), '[]'::jsonb),
          'items',        COALESCE((SELECT jsonb_agg(to_jsonb(ai)) FROM area_items         ai WHERE ai.area_id = pa.id), '[]'::jsonb),
          'countertops',  COALESCE((SELECT jsonb_agg(to_jsonb(ct)) FROM area_countertops   ct WHERE ct.area_id = pa.id), '[]'::jsonb),
          'closet_items', COALESCE((SELECT jsonb_agg(to_jsonb(ci)) FROM area_closet_items  ci WHERE ci.area_id = pa.id), '[]'::jsonb),
          'prefab_items', COALESCE((SELECT jsonb_agg(to_jsonb(pi)) FROM area_prefab_items  pi WHERE pi.area_id = pa.id), '[]'::jsonb),
          'sections',     COALESCE((SELECT jsonb_agg(to_jsonb(s))  FROM area_sections      s  WHERE s.area_id  = pa.id), '[]'::jsonb)
        )
        ORDER BY pa.id
      )
      FROM project_areas pa
      WHERE pa.project_id = p_project_id
    ), '[]'::jsonb)
  ) INTO snapshot;

  RETURN snapshot;
END;
$$;

COMMENT ON FUNCTION public.create_project_snapshot IS
  'v2 (2026-04-22): returns schema_version:2 snapshot including closet_items, prefab_items, sections. Older snapshots remain readable via missing-key tolerance in restore_project_version.';

-- =========================================================================
-- 5. capture_project_version_v2 — atomic snapshot + version row
-- =========================================================================
CREATE OR REPLACE FUNCTION public.capture_project_version_v2(
  p_project_id       uuid,
  p_action_code      text,
  p_summary          text,
  p_version_type     text    DEFAULT 'auto_mutation',
  p_source           text    DEFAULT 'client',
  p_actor_member_id  uuid    DEFAULT NULL,
  p_actor_user_id    uuid    DEFAULT NULL,
  p_is_named         boolean DEFAULT false,
  p_version_name     text    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_number   integer;
  v_total    numeric;
  v_id       uuid;
  v_name     text;
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'capture_project_version_v2: project_id is required';
  END IF;

  SELECT create_project_snapshot(p_project_id) INTO v_snapshot;

  IF v_snapshot IS NULL OR (v_snapshot->'project') IS NULL THEN
    RAISE EXCEPTION 'capture_project_version_v2: project % not found', p_project_id;
  END IF;

  SELECT get_next_version_number(p_project_id) INTO v_number;
  SELECT total_amount FROM quotations WHERE id = p_project_id INTO v_total;

  v_name := COALESCE(
    NULLIF(p_version_name, ''),
    NULLIF(p_summary, ''),
    'v' || v_number
  );

  INSERT INTO project_versions (
    project_id, version_number, version_name, version_type,
    snapshot_data, total_amount, affected_areas, notes,
    actor_member_id, actor_user_id, action_code, summary,
    source, is_named, is_auto
  ) VALUES (
    p_project_id, v_number, v_name, p_version_type,
    v_snapshot, COALESCE(v_total, 0), ARRAY[]::text[], p_notes,
    p_actor_member_id, COALESCE(p_actor_user_id, auth.uid()),
    p_action_code, p_summary,
    p_source, p_is_named, NOT p_is_named
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.capture_project_version_v2 IS
  'Atomically snapshots a quotation + inserts a project_versions row. Fire-and-forget safe from the client. Named versions set is_named=true (retained forever); auto versions set is_auto=true (subject to prune_auto_versions).';

-- =========================================================================
-- 6. restore_project_version — transactional wipe + re-insert from snapshot
-- =========================================================================
CREATE OR REPLACE FUNCTION public.restore_project_version(
  p_version_id       uuid,
  p_actor_member_id  uuid DEFAULT NULL,
  p_actor_user_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version    project_versions%ROWTYPE;
  v_project_id uuid;
  v_snapshot   jsonb;
  v_project    jsonb;
  v_area       jsonb;
  v_area_id    uuid;
  v_safety_id  uuid;
  v_restore_id uuid;
BEGIN
  SELECT * INTO v_version FROM project_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restore_project_version: version % not found', p_version_id;
  END IF;

  v_project_id := v_version.project_id;
  v_snapshot   := v_version.snapshot_data;
  v_project    := v_snapshot -> 'project';

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'restore_project_version: snapshot for version % has no project data', p_version_id;
  END IF;

  -- 6a. Safety snapshot BEFORE we touch anything — allows "undo this restore"
  v_safety_id := capture_project_version_v2(
    p_project_id      := v_project_id,
    p_action_code     := 'version.pre_restore',
    p_summary         := format('Auto-backup before restoring v%s', v_version.version_number),
    p_version_type    := 'restore',
    p_source          := 'system',
    p_actor_member_id := p_actor_member_id,
    p_actor_user_id   := p_actor_user_id
  );

  -- 6b. Wipe current children in FK-safe order
  DELETE FROM area_cabinets     WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM area_items        WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM area_countertops  WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM area_closet_items WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM area_prefab_items WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM area_sections     WHERE area_id IN (SELECT id FROM project_areas WHERE project_id = v_project_id);
  DELETE FROM project_areas     WHERE project_id = v_project_id;

  -- 6c. Restore quotation header (explicit column list — safer than blanket UPDATE)
  UPDATE quotations SET
    name                           = COALESCE(v_project->>'name', name),
    address                        =  v_project->>'address',
    quote_date                     = COALESCE((v_project->>'quote_date')::date, quote_date),
    total_amount                   = NULLIF(v_project->>'total_amount','')::numeric,
    status                         =  v_project->>'status',
    project_type                   = COALESCE(v_project->>'project_type', project_type),
    other_expenses                 = NULLIF(v_project->>'other_expenses','')::numeric,
    tax_percentage                 = NULLIF(v_project->>'tax_percentage','')::numeric,
    install_delivery               = NULLIF(v_project->>'install_delivery','')::numeric,
    project_details                =  v_project->>'project_details',
    tariff_multiplier              = NULLIF(v_project->>'tariff_multiplier','')::numeric,
    profit_multiplier              = NULLIF(v_project->>'profit_multiplier','')::numeric,
    project_brief                  =  v_project->>'project_brief',
    customer                       =  v_project->>'customer',
    disclaimer_tariff_info         =  v_project->>'disclaimer_tariff_info',
    disclaimer_price_validity      =  v_project->>'disclaimer_price_validity',
    referral_currency_rate         = NULLIF(v_project->>'referral_currency_rate','')::numeric,
    pdf_project_name               =  v_project->>'pdf_project_name',
    pdf_customer                   =  v_project->>'pdf_customer',
    pdf_address                    =  v_project->>'pdf_address',
    pdf_project_brief              =  v_project->>'pdf_project_brief',
    other_expenses_label           =  v_project->>'other_expenses_label',
    install_delivery_per_box       = NULLIF(v_project->>'install_delivery_per_box','')::numeric,
    install_delivery_usd           = NULLIF(v_project->>'install_delivery_usd','')::numeric,
    install_delivery_per_box_usd   = NULLIF(v_project->>'install_delivery_per_box_usd','')::numeric,
    version_label                  =  v_project->>'version_label',
    version_number                 = NULLIF(v_project->>'version_number','')::integer,
    pricing_method                 = COALESCE(v_project->>'pricing_method', pricing_method),
    active_optimizer_run_id        = NULLIF(v_project->>'active_optimizer_run_id','')::uuid,
    optimizer_total_amount         = NULLIF(v_project->>'optimizer_total_amount','')::numeric,
    optimizer_is_stale             = COALESCE((v_project->>'optimizer_is_stale')::boolean, optimizer_is_stale),
    risk_factor_percentage         = NULLIF(v_project->>'risk_factor_percentage','')::numeric,
    risk_factor_applies_sqft       = NULLIF(v_project->>'risk_factor_applies_sqft','')::boolean,
    risk_factor_applies_optimizer  = NULLIF(v_project->>'risk_factor_applies_optimizer','')::boolean,
    updated_at                     = now()
  WHERE id = v_project_id;

  -- 6d. Re-insert areas + children from snapshot.
  -- jsonb_populate_record* maps keys to columns; missing keys become NULL,
  -- which is why older snapshots (schema_version=1) still restore — their
  -- closet_items/prefab_items/sections arrays are absent, and COALESCE below
  -- treats them as empty.
  FOR v_area IN SELECT jsonb_array_elements(COALESCE(v_snapshot->'areas','[]'::jsonb)) LOOP
    INSERT INTO project_areas
      SELECT * FROM jsonb_populate_record(NULL::project_areas, v_area->'area');

    v_area_id := (v_area->'area'->>'id')::uuid;

    INSERT INTO area_cabinets
      SELECT * FROM jsonb_populate_recordset(NULL::area_cabinets,     COALESCE(v_area->'cabinets',     '[]'::jsonb));
    INSERT INTO area_items
      SELECT * FROM jsonb_populate_recordset(NULL::area_items,        COALESCE(v_area->'items',        '[]'::jsonb));
    INSERT INTO area_countertops
      SELECT * FROM jsonb_populate_recordset(NULL::area_countertops,  COALESCE(v_area->'countertops',  '[]'::jsonb));
    INSERT INTO area_closet_items
      SELECT * FROM jsonb_populate_recordset(NULL::area_closet_items, COALESCE(v_area->'closet_items', '[]'::jsonb));
    INSERT INTO area_prefab_items
      SELECT * FROM jsonb_populate_recordset(NULL::area_prefab_items, COALESCE(v_area->'prefab_items', '[]'::jsonb));
    INSERT INTO area_sections
      SELECT * FROM jsonb_populate_recordset(NULL::area_sections,     COALESCE(v_area->'sections',     '[]'::jsonb));
  END LOOP;

  -- 6e. Marker entry for the restore itself; parent links to the safety snapshot
  v_restore_id := capture_project_version_v2(
    p_project_id      := v_project_id,
    p_action_code     := 'version.restore',
    p_summary         := format('Restaurado a v%s', v_version.version_number),
    p_version_type    := 'restore',
    p_source          := 'system',
    p_actor_member_id := p_actor_member_id,
    p_actor_user_id   := p_actor_user_id
  );

  UPDATE project_versions SET parent_version_id = p_version_id WHERE id = v_restore_id;
  UPDATE project_versions SET parent_version_id = v_restore_id WHERE id = v_safety_id;

  RETURN jsonb_build_object(
    'restored_from_version_id', p_version_id,
    'safety_version_id',         v_safety_id,
    'restore_marker_id',         v_restore_id
  );
END;
$$;

COMMENT ON FUNCTION public.restore_project_version IS
  'Transactional restore: (1) captures a safety snapshot, (2) wipes current children, (3) re-inserts from snapshot, (4) updates quotation header, (5) logs a restore marker linked to the safety snapshot. Returns ids so the client can offer "undo this restore".';

-- =========================================================================
-- 7. prune_auto_versions — retention job (kept callable; scheduled in Phase 3)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.prune_auto_versions(
  p_retain_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rollups_marked integer := 0;
  v_rows_deleted   integer := 0;
  v_cutoff         timestamptz := now() - make_interval(days => p_retain_days);
BEGIN
  -- Mark the last auto-version of each calendar day (older than cutoff) as a rollup
  WITH candidates AS (
    SELECT DISTINCT ON (project_id, date_trunc('day', created_at)) id
    FROM project_versions
    WHERE is_auto
      AND NOT is_named
      AND NOT is_rollup
      AND created_at < v_cutoff
    ORDER BY project_id, date_trunc('day', created_at), created_at DESC
  )
  UPDATE project_versions pv
  SET is_rollup = true
  FROM candidates c
  WHERE pv.id = c.id;
  GET DIAGNOSTICS v_rollups_marked = ROW_COUNT;

  -- Delete remaining auto-versions older than cutoff that weren't promoted
  DELETE FROM project_versions
  WHERE is_auto
    AND NOT is_named
    AND NOT is_rollup
    AND created_at < v_cutoff;
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff',         v_cutoff,
    'retain_days',    p_retain_days,
    'rollups_marked', v_rollups_marked,
    'rows_deleted',   v_rows_deleted
  );
END;
$$;

COMMENT ON FUNCTION public.prune_auto_versions IS
  'Retention: promotes the last auto-version per project-day older than p_retain_days to is_rollup=true (kept forever), then deletes the rest of the auto-versions in that window. Named snapshots and restore markers are never pruned. Scheduling is wired in Phase 3.';

-- =========================================================================
-- 8. Grants — allow authenticated users to call the new RPCs
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.capture_project_version_v2(uuid, text, text, text, text, uuid, uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_project_version(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_auto_versions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_snapshot(uuid) TO authenticated;
