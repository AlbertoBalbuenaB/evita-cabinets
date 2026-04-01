/*
  # Enhance Project Tasks

  1. Modify project_tasks
    - Change due_date from DATE to TIMESTAMPTZ (supports time-of-day)
    - Add priority column (low, medium, high, urgent)
    - Add parent_task_id for subtask nesting
    - Add description column (richer replacement for details)
    - Expand status constraint (add in_review, blocked, cancelled)

  2. New Tables
    - task_assignees       - many-to-many tasks ↔ team_members
    - task_tags            - tag definitions per project
    - task_tag_assignments - many-to-many tasks ↔ tags
    - task_comments        - threaded comments with TipTap HTML body
    - task_comment_replies - nested replies to comments
    - task_deliverables    - label + URL per task

  3. Security
    - RLS enabled on all new tables
    - Authenticated users full access policies
*/

-- ── 1. Alter project_tasks ──────────────────────────────────────────────────

-- Expand status to include new values (drop old check, add new)
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE project_tasks
  ADD CONSTRAINT project_tasks_status_check
    CHECK (status IN ('pending', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'));

-- Change due_date from DATE to TIMESTAMPTZ
ALTER TABLE project_tasks
  ALTER COLUMN due_date TYPE timestamptz USING (due_date::timestamptz);

-- Add priority
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add parent_task_id for subtask nesting
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE;

-- Add description (richer replacement; keep details for backwards compat)
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id ON project_tasks(parent_task_id);

-- ── 2. task_assignees (many-to-many) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id   uuid NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, member_id)
);

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task assignees"
  ON task_assignees FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task assignees"
  ON task_assignees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task assignees"
  ON task_assignees FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── 3. task_tags ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      text NOT NULL,
  color      text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_tags_project_id ON task_tags(project_id);

CREATE POLICY "Authenticated users can view task tags"
  ON task_tags FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task tags"
  ON task_tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update task tags"
  ON task_tags FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task tags"
  ON task_tags FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── 4. task_tag_assignments (many-to-many) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS task_tag_assignments (
  task_id uuid NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE task_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task tag assignments"
  ON task_tag_assignments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task tag assignments"
  ON task_tag_assignments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task tag assignments"
  ON task_tag_assignments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── 5. task_comments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

CREATE POLICY "Authenticated users can view task comments"
  ON task_comments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task comments"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update task comments"
  ON task_comments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task comments"
  ON task_comments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── 6. task_comment_replies ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_comment_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_comment_replies_comment_id ON task_comment_replies(comment_id);

CREATE POLICY "Authenticated users can view task comment replies"
  ON task_comment_replies FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task comment replies"
  ON task_comment_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task comment replies"
  ON task_comment_replies FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── 7. task_deliverables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_deliverables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  label         text NOT NULL,
  url           text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE task_deliverables ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_deliverables_task_id ON task_deliverables(task_id);

CREATE POLICY "Authenticated users can view task deliverables"
  ON task_deliverables FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task deliverables"
  ON task_deliverables FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update task deliverables"
  ON task_deliverables FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task deliverables"
  ON task_deliverables FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
