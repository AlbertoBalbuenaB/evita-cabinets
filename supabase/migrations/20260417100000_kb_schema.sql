/*
  # Knowledge Base — Phase 1A schema

  Adds the core tables for the KB module:
    kb_categories          — taxonomy (admin-editable)
    kb_suppliers           — first-class supplier entities; optional FK to existing suppliers
    kb_entries             — unified narrative + structured knowledge entries
    kb_entry_versions      — full-row snapshots (version history)
    kb_proposals           — pull-request-style proposals (create/edit/delete)
    kb_comments            — threaded comments on proposals or entries (TipTap JSON)
    kb_audit_log           — immutable mutation audit trail

  Also adds the reusable SQL helpers:
    current_member_id()    — maps auth.uid() -> team_members.id
    is_admin()             — true if current auth user has role = 'admin'

  Seeding is handled by a separate migration (kb_seed). Proposal state-machine
  trigger enforcement is added in PR 1B alongside the merge RPC.
*/

-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- Reusable helper functions (shared across future modules)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM team_members
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.current_member_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- kb_categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  section_num   text,
  description   text,
  sort_order    int NOT NULL DEFAULT 0,
  parent_id     uuid REFERENCES kb_categories(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_categories_parent_idx ON kb_categories (parent_id);
CREATE INDEX IF NOT EXISTS kb_categories_sort_idx   ON kb_categories (sort_order);

-- ============================================================================
-- kb_suppliers (first-class KB supplier entity; optional bridge to `suppliers`)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_suppliers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  ops_supplier_id  uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  categories       text[] NOT NULL DEFAULT '{}',
  contact          jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_md         text NOT NULL DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  search_tsv       tsvector,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_suppliers_tsv_idx       ON kb_suppliers USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS kb_suppliers_name_trgm_idx ON kb_suppliers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS kb_suppliers_active_idx    ON kb_suppliers (is_active);
CREATE INDEX IF NOT EXISTS kb_suppliers_ops_idx       ON kb_suppliers (ops_supplier_id);

CREATE OR REPLACE FUNCTION public.kb_suppliers_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.notes_md, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_suppliers_tsv_trg ON kb_suppliers;
CREATE TRIGGER kb_suppliers_tsv_trg
  BEFORE INSERT OR UPDATE OF name, notes_md ON kb_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.kb_suppliers_update_search_tsv();

DROP TRIGGER IF EXISTS kb_suppliers_set_updated_at ON kb_suppliers;
CREATE TRIGGER kb_suppliers_set_updated_at
  BEFORE UPDATE ON kb_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- kb_entries (main unified entry table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  category_id       uuid NOT NULL REFERENCES kb_categories(id) ON DELETE RESTRICT,
  entry_type        text NOT NULL CHECK (entry_type IN (
                      'finish','edge_band','toe_kick','hardware','panel','shelf',
                      'countertop','blind','cost_constant','rule','glossary','general'
                    )),
  body_md           text NOT NULL DEFAULT '',
  structured_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags              text[] NOT NULL DEFAULT '{}',
  supplier_ids      uuid[] NOT NULL DEFAULT '{}',
  product_refs      uuid[] NOT NULL DEFAULT '{}',
  price_item_refs   uuid[] NOT NULL DEFAULT '{}',
  needs_enrichment  boolean NOT NULL DEFAULT false,
  enrichment_notes  text,
  current_version   int NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  search_tsv        tsvector,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES team_members(id) ON DELETE SET NULL,
  last_edited_by    uuid REFERENCES team_members(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.kb_entries_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.body_md, '')), 'C') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.structured_data::text, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_entries_tsv_trg ON kb_entries;
CREATE TRIGGER kb_entries_tsv_trg
  BEFORE INSERT OR UPDATE OF title, tags, body_md, structured_data ON kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.kb_entries_update_search_tsv();

CREATE INDEX IF NOT EXISTS kb_entries_tsv_idx        ON kb_entries USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS kb_entries_title_trgm_idx ON kb_entries USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS kb_entries_category_idx   ON kb_entries (category_id);
CREATE INDEX IF NOT EXISTS kb_entries_type_idx       ON kb_entries (entry_type);
CREATE INDEX IF NOT EXISTS kb_entries_status_idx     ON kb_entries (status);
CREATE INDEX IF NOT EXISTS kb_entries_updated_idx    ON kb_entries (updated_at DESC);
CREATE INDEX IF NOT EXISTS kb_entries_suppliers_gin  ON kb_entries USING GIN (supplier_ids);
CREATE INDEX IF NOT EXISTS kb_entries_products_gin   ON kb_entries USING GIN (product_refs);
CREATE INDEX IF NOT EXISTS kb_entries_tags_gin       ON kb_entries USING GIN (tags);

DROP TRIGGER IF EXISTS kb_entries_set_updated_at ON kb_entries;
CREATE TRIGGER kb_entries_set_updated_at
  BEFORE UPDATE ON kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- kb_entry_versions (full-row snapshots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_entry_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         uuid NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
  version_num      int NOT NULL,
  title            text NOT NULL,
  slug             text NOT NULL,
  category_id      uuid NOT NULL,
  entry_type       text NOT NULL,
  body_md          text NOT NULL,
  structured_data  jsonb NOT NULL,
  tags             text[] NOT NULL,
  supplier_ids     uuid[] NOT NULL,
  product_refs     uuid[] NOT NULL,
  price_item_refs  uuid[] NOT NULL,
  edited_by        uuid REFERENCES team_members(id) ON DELETE SET NULL,
  edit_summary     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, version_num)
);

CREATE INDEX IF NOT EXISTS kb_entry_versions_entry_idx ON kb_entry_versions (entry_id, version_num DESC);

-- ============================================================================
-- kb_proposals (PR-style)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_proposals (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                       text NOT NULL CHECK (kind IN ('create','edit','delete')),
  target_entry_id            uuid REFERENCES kb_entries(id) ON DELETE CASCADE,
  base_version               int,
  proposed_slug              text,
  proposed_title             text,
  proposed_category_id       uuid REFERENCES kb_categories(id) ON DELETE SET NULL,
  proposed_entry_type        text,
  proposed_body_md           text,
  proposed_structured_data   jsonb,
  proposed_tags              text[],
  proposed_supplier_ids      uuid[],
  proposed_product_refs      uuid[],
  proposed_price_item_refs   uuid[],
  summary                    text NOT NULL,
  description_md             text,
  state                      text NOT NULL DEFAULT 'open' CHECK (state IN (
                               'draft','open','changes_requested','approved',
                               'rejected','merged','withdrawn'
                             )),
  author_id                  uuid NOT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  reviewer_id                uuid REFERENCES team_members(id) ON DELETE SET NULL,
  reviewed_at                timestamptz,
  review_note                text,
  merged_at                  timestamptz,
  merged_version             int,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_proposals_state_idx  ON kb_proposals (state, created_at DESC);
CREATE INDEX IF NOT EXISTS kb_proposals_target_idx ON kb_proposals (target_entry_id);
CREATE INDEX IF NOT EXISTS kb_proposals_author_idx ON kb_proposals (author_id);

DROP TRIGGER IF EXISTS kb_proposals_set_updated_at ON kb_proposals;
CREATE TRIGGER kb_proposals_set_updated_at
  BEFORE UPDATE ON kb_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- kb_comments (threaded; reuses TipTap editor from BitacoraSection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid REFERENCES kb_proposals(id) ON DELETE CASCADE,
  entry_id      uuid REFERENCES kb_entries(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES kb_comments(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  body_tiptap   jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((proposal_id IS NOT NULL) OR (entry_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS kb_comments_proposal_idx ON kb_comments (proposal_id, created_at);
CREATE INDEX IF NOT EXISTS kb_comments_entry_idx    ON kb_comments (entry_id, created_at);
CREATE INDEX IF NOT EXISTS kb_comments_parent_idx   ON kb_comments (parent_id);

DROP TRIGGER IF EXISTS kb_comments_set_updated_at ON kb_comments;
CREATE TRIGGER kb_comments_set_updated_at
  BEFORE UPDATE ON kb_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- kb_audit_log (immutable; populated by trigger/SECURITY DEFINER functions in 1B)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES team_members(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entry_id     uuid REFERENCES kb_entries(id) ON DELETE SET NULL,
  proposal_id  uuid REFERENCES kb_proposals(id) ON DELETE SET NULL,
  diff_json    jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_audit_entry_idx    ON kb_audit_log (entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kb_audit_proposal_idx ON kb_audit_log (proposal_id);
CREATE INDEX IF NOT EXISTS kb_audit_actor_idx    ON kb_audit_log (actor_id, created_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE kb_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_entry_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_audit_log       ENABLE ROW LEVEL SECURITY;

-- kb_categories: read by authenticated; write admin only
CREATE POLICY "Authenticated users can view kb_categories"
  ON kb_categories FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert kb_categories"
  ON kb_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update kb_categories"
  ON kb_categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete kb_categories"
  ON kb_categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- kb_suppliers: read by authenticated; write admin only
CREATE POLICY "Authenticated users can view kb_suppliers"
  ON kb_suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert kb_suppliers"
  ON kb_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update kb_suppliers"
  ON kb_suppliers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete kb_suppliers"
  ON kb_suppliers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- kb_entries: read non-archived for everyone; admins see all; write admin only
CREATE POLICY "Authenticated users can view published kb_entries"
  ON kb_entries FOR SELECT
  TO authenticated
  USING (status <> 'archived' OR public.is_admin());

CREATE POLICY "Admins can insert kb_entries"
  ON kb_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update kb_entries"
  ON kb_entries FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete kb_entries"
  ON kb_entries FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- kb_entry_versions: read by authenticated; writes only via SECURITY DEFINER fns (1B)
CREATE POLICY "Authenticated users can view kb_entry_versions"
  ON kb_entry_versions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- kb_proposals: authenticated can read; contributors can author; admins review
CREATE POLICY "Authenticated users can view kb_proposals"
  ON kb_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Contributors can insert own kb_proposals"
  ON kb_proposals FOR INSERT
  TO authenticated
  WITH CHECK (author_id = public.current_member_id());

CREATE POLICY "Authors or admins can update kb_proposals"
  ON kb_proposals FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      author_id = public.current_member_id()
      AND state IN ('draft','changes_requested')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      author_id = public.current_member_id()
      AND state IN ('draft','changes_requested','open','withdrawn')
    )
  );

CREATE POLICY "Authors can delete own draft kb_proposals"
  ON kb_proposals FOR DELETE
  TO authenticated
  USING (
    author_id = public.current_member_id()
    AND state = 'draft'
  );

-- kb_comments: authenticated read; authors write their own; admins can moderate
CREATE POLICY "Authenticated users can view kb_comments"
  ON kb_comments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authors can insert own kb_comments"
  ON kb_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = public.current_member_id());

CREATE POLICY "Authors or admins can update kb_comments"
  ON kb_comments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      author_id = public.current_member_id()
      AND created_at > (now() - interval '15 minutes')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR author_id = public.current_member_id()
  );

CREATE POLICY "Authors or admins can delete kb_comments"
  ON kb_comments FOR DELETE
  TO authenticated
  USING (public.is_admin() OR author_id = public.current_member_id());

-- kb_audit_log: authenticated can read; writes only via SECURITY DEFINER fns (1B)
CREATE POLICY "Authenticated users can view kb_audit_log"
  ON kb_audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- Grants (RLS is the enforcement layer; these make tables visible to PostgREST)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON kb_categories      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_suppliers       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_entries         TO authenticated;
GRANT SELECT                          ON kb_entry_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_proposals       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_comments        TO authenticated;
GRANT SELECT                          ON kb_audit_log      TO authenticated;
