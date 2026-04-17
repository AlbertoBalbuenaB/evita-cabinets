/*
  # Knowledge Base — Phase 1B proposal workflow

  Adds the state-machine trigger that enforces valid transitions on
  `kb_proposals`, the transactional `kb_merge_proposal` RPC that applies
  an approved proposal to `kb_entries`, snapshots a new version, writes
  an audit log row, and marks the proposal as merged.

  Also adjusts the kb_proposals UPDATE policy so that authors can
  withdraw from `open` state (previously only `draft` / `changes_requested`
  were allowed as the OLD state).
*/

-- ============================================================================
-- UPDATE policy: allow authors to update their own proposals in any
-- non-terminal state (the trigger below enforces valid transitions).
-- ============================================================================
DROP POLICY IF EXISTS "Authors or admins can update kb_proposals" ON kb_proposals;
CREATE POLICY "Authors or admins can update kb_proposals"
  ON kb_proposals FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      author_id = public.current_member_id()
      AND state IN ('draft','open','changes_requested')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      author_id = public.current_member_id()
      AND state IN ('draft','open','changes_requested','withdrawn')
    )
  );

-- ============================================================================
-- State-machine trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.kb_proposals_validate_transition()
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
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

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

  IF v_is_admin AND v_admin_ok THEN
    RETURN NEW;
  END IF;

  IF v_is_author AND v_author_ok THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'kb_proposals: invalid transition % -> % (admin=%, author=%)',
    OLD.state, NEW.state, v_is_admin, v_is_author;
END;
$$;

DROP TRIGGER IF EXISTS kb_proposals_state_trg ON kb_proposals;
CREATE TRIGGER kb_proposals_state_trg
  BEFORE UPDATE OF state ON kb_proposals
  FOR EACH ROW EXECUTE FUNCTION public.kb_proposals_validate_transition();

-- ============================================================================
-- kb_merge_proposal — transactional merge RPC (admin-only)
--
-- Applies an APPROVED proposal: writes entry changes, snapshots a new
-- kb_entry_versions row, records kb_audit_log, and marks the proposal
-- as merged. Uses optimistic concurrency on base_version for edits.
--
-- Returns the entry_id that was created / updated / archived.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.kb_merge_proposal(
  p_proposal_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal     kb_proposals%ROWTYPE;
  v_actor        uuid := public.current_member_id();
  v_target       uuid;
  v_new_version  int;
  v_base_ok      boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'kb_merge_proposal: admin only';
  END IF;

  SELECT * INTO v_proposal FROM kb_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kb_merge_proposal: proposal % not found', p_proposal_id;
  END IF;

  IF v_proposal.state <> 'approved' THEN
    RAISE EXCEPTION 'kb_merge_proposal: state is % but must be approved', v_proposal.state;
  END IF;

  IF v_proposal.kind = 'create' THEN
    IF v_proposal.proposed_slug IS NULL
       OR v_proposal.proposed_title IS NULL
       OR v_proposal.proposed_category_id IS NULL
       OR v_proposal.proposed_entry_type IS NULL THEN
      RAISE EXCEPTION 'kb_merge_proposal: create requires slug, title, category_id, entry_type';
    END IF;

    INSERT INTO kb_entries (
      slug, title, category_id, entry_type, body_md, structured_data,
      tags, supplier_ids, product_refs, price_item_refs,
      created_by, last_edited_by, current_version
    )
    VALUES (
      v_proposal.proposed_slug, v_proposal.proposed_title,
      v_proposal.proposed_category_id, v_proposal.proposed_entry_type,
      coalesce(v_proposal.proposed_body_md, ''),
      coalesce(v_proposal.proposed_structured_data, '{}'::jsonb),
      coalesce(v_proposal.proposed_tags, '{}'::text[]),
      coalesce(v_proposal.proposed_supplier_ids, '{}'::uuid[]),
      coalesce(v_proposal.proposed_product_refs, '{}'::uuid[]),
      coalesce(v_proposal.proposed_price_item_refs, '{}'::uuid[]),
      v_proposal.author_id, v_actor, 1
    )
    RETURNING id INTO v_target;
    v_new_version := 1;

  ELSIF v_proposal.kind = 'edit' THEN
    v_target := v_proposal.target_entry_id;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'kb_merge_proposal: edit proposal missing target_entry_id';
    END IF;

    IF v_proposal.base_version IS NOT NULL THEN
      SELECT (current_version = v_proposal.base_version) INTO v_base_ok
      FROM kb_entries WHERE id = v_target;
      IF NOT coalesce(v_base_ok, false) THEN
        RAISE EXCEPTION
          'kb_merge_proposal: base version stale — current entry is newer, please rebase';
      END IF;
    END IF;

    UPDATE kb_entries
    SET
      slug            = coalesce(v_proposal.proposed_slug, slug),
      title           = coalesce(v_proposal.proposed_title, title),
      category_id     = coalesce(v_proposal.proposed_category_id, category_id),
      entry_type      = coalesce(v_proposal.proposed_entry_type, entry_type),
      body_md         = coalesce(v_proposal.proposed_body_md, body_md),
      structured_data = coalesce(v_proposal.proposed_structured_data, structured_data),
      tags            = coalesce(v_proposal.proposed_tags, tags),
      supplier_ids    = coalesce(v_proposal.proposed_supplier_ids, supplier_ids),
      product_refs    = coalesce(v_proposal.proposed_product_refs, product_refs),
      price_item_refs = coalesce(v_proposal.proposed_price_item_refs, price_item_refs),
      current_version = current_version + 1,
      last_edited_by  = v_actor
    WHERE id = v_target
    RETURNING current_version INTO v_new_version;

  ELSIF v_proposal.kind = 'delete' THEN
    v_target := v_proposal.target_entry_id;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'kb_merge_proposal: delete proposal missing target_entry_id';
    END IF;

    UPDATE kb_entries
    SET status          = 'archived',
        current_version = current_version + 1,
        last_edited_by  = v_actor
    WHERE id = v_target
    RETURNING current_version INTO v_new_version;
  ELSE
    RAISE EXCEPTION 'kb_merge_proposal: unknown kind %', v_proposal.kind;
  END IF;

  INSERT INTO kb_entry_versions (
    entry_id, version_num, title, slug, category_id, entry_type,
    body_md, structured_data, tags, supplier_ids, product_refs, price_item_refs,
    edited_by, edit_summary
  )
  SELECT
    id, current_version, title, slug, category_id, entry_type,
    body_md, structured_data, tags, supplier_ids, product_refs, price_item_refs,
    v_actor, v_proposal.summary
  FROM kb_entries WHERE id = v_target;

  INSERT INTO kb_audit_log (actor_id, action, entry_id, proposal_id, diff_json)
  VALUES (
    v_actor,
    'proposal.' || v_proposal.kind || '.merge',
    v_target,
    p_proposal_id,
    jsonb_build_object(
      'kind', v_proposal.kind,
      'base_version', v_proposal.base_version,
      'new_version', v_new_version
    )
  );

  UPDATE kb_proposals
  SET state          = 'merged',
      reviewer_id    = v_actor,
      reviewed_at    = now(),
      review_note    = coalesce(p_note, review_note),
      merged_at      = now(),
      merged_version = v_new_version
  WHERE id = p_proposal_id;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.kb_merge_proposal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kb_merge_proposal(uuid, text) TO authenticated;

-- ============================================================================
-- Lightweight audit log for direct admin actions (approve/reject without
-- merge). The merge path writes to kb_audit_log inside kb_merge_proposal;
-- approve/reject/request_changes/withdraw are audited by a simple AFTER
-- UPDATE trigger so the history is complete.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.kb_proposals_audit_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;
  IF NEW.state = 'merged' THEN
    -- merge path already writes its own audit row
    RETURN NEW;
  END IF;

  INSERT INTO kb_audit_log (actor_id, action, entry_id, proposal_id, diff_json)
  VALUES (
    public.current_member_id(),
    'proposal.' || OLD.state || '_to_' || NEW.state,
    NEW.target_entry_id,
    NEW.id,
    jsonb_build_object('from', OLD.state, 'to', NEW.state)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_proposals_audit_trg ON kb_proposals;
CREATE TRIGGER kb_proposals_audit_trg
  AFTER UPDATE OF state ON kb_proposals
  FOR EACH ROW EXECUTE FUNCTION public.kb_proposals_audit_state_change();
