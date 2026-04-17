/*
  # Wiki — Phase 2B proposal workflow

  Mirrors kb_* Phase 1B: proposals (state machine), comments (TipTap JSON),
  audit log, and the transactional merge RPC.
*/

-- ============================================================================
-- wiki_proposals
-- ============================================================================
CREATE TABLE IF NOT EXISTS wiki_proposals (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                       text NOT NULL CHECK (kind IN ('create','edit','delete')),
  target_article_id          uuid REFERENCES wiki_articles(id) ON DELETE CASCADE,
  base_version               int,
  proposed_slug              text,
  proposed_title             text,
  proposed_summary           text,
  proposed_category_id       uuid REFERENCES wiki_categories(id) ON DELETE SET NULL,
  proposed_body_md           text,
  proposed_tags              text[],
  proposed_reading_time_min  int,
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

CREATE INDEX IF NOT EXISTS wiki_proposals_state_idx   ON wiki_proposals (state, created_at DESC);
CREATE INDEX IF NOT EXISTS wiki_proposals_target_idx  ON wiki_proposals (target_article_id);
CREATE INDEX IF NOT EXISTS wiki_proposals_author_idx  ON wiki_proposals (author_id);

DROP TRIGGER IF EXISTS wiki_proposals_set_updated_at ON wiki_proposals;
CREATE TRIGGER wiki_proposals_set_updated_at
  BEFORE UPDATE ON wiki_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- wiki_comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS wiki_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid REFERENCES wiki_proposals(id) ON DELETE CASCADE,
  article_id    uuid REFERENCES wiki_articles(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES wiki_comments(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  body_tiptap   jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((proposal_id IS NOT NULL) OR (article_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS wiki_comments_proposal_idx ON wiki_comments (proposal_id, created_at);
CREATE INDEX IF NOT EXISTS wiki_comments_article_idx  ON wiki_comments (article_id, created_at);
CREATE INDEX IF NOT EXISTS wiki_comments_parent_idx   ON wiki_comments (parent_id);

DROP TRIGGER IF EXISTS wiki_comments_set_updated_at ON wiki_comments;
CREATE TRIGGER wiki_comments_set_updated_at
  BEFORE UPDATE ON wiki_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- wiki_audit_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS wiki_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES team_members(id) ON DELETE SET NULL,
  action       text NOT NULL,
  article_id   uuid REFERENCES wiki_articles(id) ON DELETE SET NULL,
  proposal_id  uuid REFERENCES wiki_proposals(id) ON DELETE SET NULL,
  diff_json    jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wiki_audit_article_idx  ON wiki_audit_log (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wiki_audit_proposal_idx ON wiki_audit_log (proposal_id);
CREATE INDEX IF NOT EXISTS wiki_audit_actor_idx    ON wiki_audit_log (actor_id, created_at DESC);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE wiki_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wiki_proposals"
  ON wiki_proposals FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Contributors can insert own wiki_proposals"
  ON wiki_proposals FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_member_id());

CREATE POLICY "Authors or admins can update wiki_proposals"
  ON wiki_proposals FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (author_id = public.current_member_id() AND state IN ('draft','open','changes_requested'))
  )
  WITH CHECK (
    public.is_admin()
    OR (author_id = public.current_member_id() AND state IN ('draft','open','changes_requested','withdrawn'))
  );

CREATE POLICY "Authors can delete own draft wiki_proposals"
  ON wiki_proposals FOR DELETE TO authenticated
  USING (author_id = public.current_member_id() AND state = 'draft');

CREATE POLICY "Authenticated users can view wiki_comments"
  ON wiki_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authors can insert own wiki_comments"
  ON wiki_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_member_id());

CREATE POLICY "Authors or admins can update wiki_comments"
  ON wiki_comments FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (author_id = public.current_member_id() AND created_at > (now() - interval '15 minutes'))
  )
  WITH CHECK (public.is_admin() OR author_id = public.current_member_id());

CREATE POLICY "Authors or admins can delete wiki_comments"
  ON wiki_comments FOR DELETE TO authenticated
  USING (public.is_admin() OR author_id = public.current_member_id());

CREATE POLICY "Authenticated users can view wiki_audit_log"
  ON wiki_audit_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON wiki_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wiki_comments  TO authenticated;
GRANT SELECT                         ON wiki_audit_log TO authenticated;

-- ============================================================================
-- State-machine trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wiki_proposals_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin  boolean := public.is_admin();
  v_is_author boolean := (OLD.author_id = public.current_member_id());
  v_admin_ok  boolean;
  v_author_ok boolean;
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;

  v_admin_ok := (
    (OLD.state = 'draft'            AND NEW.state IN ('approved','rejected'))
 OR (OLD.state = 'open'             AND NEW.state IN ('approved','rejected','changes_requested'))
 OR (OLD.state = 'changes_requested' AND NEW.state IN ('approved','rejected'))
 OR (OLD.state = 'approved'         AND NEW.state = 'merged')
  );
  v_author_ok := (
    (OLD.state = 'draft'             AND NEW.state IN ('open','withdrawn'))
 OR (OLD.state = 'open'              AND NEW.state = 'withdrawn')
 OR (OLD.state = 'changes_requested' AND NEW.state IN ('open','withdrawn'))
  );

  IF v_is_admin  AND v_admin_ok  THEN RETURN NEW; END IF;
  IF v_is_author AND v_author_ok THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'wiki_proposals: invalid transition % -> % (admin=%, author=%)',
    OLD.state, NEW.state, v_is_admin, v_is_author;
END;
$$;

DROP TRIGGER IF EXISTS wiki_proposals_state_trg ON wiki_proposals;
CREATE TRIGGER wiki_proposals_state_trg
  BEFORE UPDATE OF state ON wiki_proposals
  FOR EACH ROW EXECUTE FUNCTION public.wiki_proposals_validate_transition();

-- ============================================================================
-- wiki_merge_proposal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wiki_merge_proposal(
  p_proposal_id uuid,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal wiki_proposals%ROWTYPE;
  v_actor uuid := public.current_member_id();
  v_target uuid;
  v_new_version int;
  v_base_ok boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'wiki_merge_proposal: admin only';
  END IF;

  SELECT * INTO v_proposal FROM wiki_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wiki_merge_proposal: proposal % not found', p_proposal_id;
  END IF;
  IF v_proposal.state <> 'approved' THEN
    RAISE EXCEPTION 'wiki_merge_proposal: state is %, must be approved', v_proposal.state;
  END IF;

  IF v_proposal.kind = 'create' THEN
    IF v_proposal.proposed_slug IS NULL OR v_proposal.proposed_title IS NULL OR v_proposal.proposed_category_id IS NULL THEN
      RAISE EXCEPTION 'wiki_merge_proposal: create requires slug, title, category_id';
    END IF;
    INSERT INTO wiki_articles (
      slug, title, summary, category_id, body_md, tags, reading_time_min,
      created_by, last_edited_by, current_version
    ) VALUES (
      v_proposal.proposed_slug, v_proposal.proposed_title, v_proposal.proposed_summary,
      v_proposal.proposed_category_id,
      coalesce(v_proposal.proposed_body_md, ''),
      coalesce(v_proposal.proposed_tags, '{}'::text[]),
      v_proposal.proposed_reading_time_min,
      v_proposal.author_id, v_actor, 1
    ) RETURNING id INTO v_target;
    v_new_version := 1;

  ELSIF v_proposal.kind = 'edit' THEN
    v_target := v_proposal.target_article_id;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'wiki_merge_proposal: edit missing target_article_id';
    END IF;
    IF v_proposal.base_version IS NOT NULL THEN
      SELECT (current_version = v_proposal.base_version) INTO v_base_ok
      FROM wiki_articles WHERE id = v_target;
      IF NOT coalesce(v_base_ok, false) THEN
        RAISE EXCEPTION 'wiki_merge_proposal: base version stale - please rebase';
      END IF;
    END IF;
    UPDATE wiki_articles SET
      slug             = coalesce(v_proposal.proposed_slug, slug),
      title            = coalesce(v_proposal.proposed_title, title),
      summary          = coalesce(v_proposal.proposed_summary, summary),
      category_id      = coalesce(v_proposal.proposed_category_id, category_id),
      body_md          = coalesce(v_proposal.proposed_body_md, body_md),
      tags             = coalesce(v_proposal.proposed_tags, tags),
      reading_time_min = coalesce(v_proposal.proposed_reading_time_min, reading_time_min),
      current_version  = current_version + 1,
      last_edited_by   = v_actor
    WHERE id = v_target
    RETURNING current_version INTO v_new_version;

  ELSIF v_proposal.kind = 'delete' THEN
    v_target := v_proposal.target_article_id;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'wiki_merge_proposal: delete missing target_article_id';
    END IF;
    UPDATE wiki_articles SET
      status = 'archived',
      current_version = current_version + 1,
      last_edited_by = v_actor
    WHERE id = v_target
    RETURNING current_version INTO v_new_version;
  ELSE
    RAISE EXCEPTION 'wiki_merge_proposal: unknown kind %', v_proposal.kind;
  END IF;

  INSERT INTO wiki_article_versions (
    article_id, version_num, title, slug, summary, category_id, body_md, tags,
    edited_by, edit_summary
  )
  SELECT id, current_version, title, slug, summary, category_id, body_md, tags,
         v_actor, v_proposal.summary
  FROM wiki_articles WHERE id = v_target;

  INSERT INTO wiki_audit_log (actor_id, action, article_id, proposal_id, diff_json)
  VALUES (v_actor, 'proposal.' || v_proposal.kind || '.merge', v_target, p_proposal_id,
    jsonb_build_object('kind', v_proposal.kind, 'base_version', v_proposal.base_version, 'new_version', v_new_version));

  UPDATE wiki_proposals SET state = 'merged', reviewer_id = v_actor, reviewed_at = now(),
    review_note = coalesce(p_note, review_note), merged_at = now(), merged_version = v_new_version
  WHERE id = p_proposal_id;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.wiki_merge_proposal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wiki_merge_proposal(uuid, text) TO authenticated;

-- ============================================================================
-- Non-merge state change audit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wiki_proposals_audit_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;
  IF NEW.state = 'merged' THEN RETURN NEW; END IF;
  INSERT INTO wiki_audit_log (actor_id, action, article_id, proposal_id, diff_json)
  VALUES (public.current_member_id(),
    'proposal.' || OLD.state || '_to_' || NEW.state,
    NEW.target_article_id, NEW.id,
    jsonb_build_object('from', OLD.state, 'to', NEW.state));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wiki_proposals_audit_trg ON wiki_proposals;
CREATE TRIGGER wiki_proposals_audit_trg
  AFTER UPDATE OF state ON wiki_proposals
  FOR EACH ROW EXECUTE FUNCTION public.wiki_proposals_audit_state_change();
