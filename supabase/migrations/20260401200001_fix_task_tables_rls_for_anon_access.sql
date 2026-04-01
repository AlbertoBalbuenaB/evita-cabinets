/*
  # Fix RLS policies on task tables to allow anon access

  The app uses the Supabase anon client, not authenticated.
  Replace authenticated-only policies with open anon+authenticated policies,
  same pattern as fix_new_tables_rls_for_anon_access (20260319232234).
*/

-- task_assignees
DROP POLICY IF EXISTS "Authenticated users can view task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Authenticated users can insert task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Authenticated users can delete task assignees" ON task_assignees;
CREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- task_tags
DROP POLICY IF EXISTS "Authenticated users can view task tags" ON task_tags;
DROP POLICY IF EXISTS "Authenticated users can insert task tags" ON task_tags;
DROP POLICY IF EXISTS "Authenticated users can update task tags" ON task_tags;
DROP POLICY IF EXISTS "Authenticated users can delete task tags" ON task_tags;
CREATE POLICY "Allow all on task_tags" ON task_tags FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- task_tag_assignments
DROP POLICY IF EXISTS "Authenticated users can view task tag assignments" ON task_tag_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert task tag assignments" ON task_tag_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete task tag assignments" ON task_tag_assignments;
CREATE POLICY "Allow all on task_tag_assignments" ON task_tag_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- task_comments
DROP POLICY IF EXISTS "Authenticated users can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can insert task comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can update task comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can delete task comments" ON task_comments;
CREATE POLICY "Allow all on task_comments" ON task_comments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- task_comment_replies
DROP POLICY IF EXISTS "Authenticated users can view task comment replies" ON task_comment_replies;
DROP POLICY IF EXISTS "Authenticated users can insert task comment replies" ON task_comment_replies;
DROP POLICY IF EXISTS "Authenticated users can delete task comment replies" ON task_comment_replies;
CREATE POLICY "Allow all on task_comment_replies" ON task_comment_replies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- task_deliverables
DROP POLICY IF EXISTS "Authenticated users can view task deliverables" ON task_deliverables;
DROP POLICY IF EXISTS "Authenticated users can insert task deliverables" ON task_deliverables;
DROP POLICY IF EXISTS "Authenticated users can update task deliverables" ON task_deliverables;
DROP POLICY IF EXISTS "Authenticated users can delete task deliverables" ON task_deliverables;
CREATE POLICY "Allow all on task_deliverables" ON task_deliverables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
