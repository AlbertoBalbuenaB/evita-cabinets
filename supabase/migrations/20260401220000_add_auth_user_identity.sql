/*
  # Add Auth User Identity & Lock Down RLS

  ## What this migration does
  1. Links team_members to auth.users via auth_user_id column
  2. Creates handle_new_user() trigger to auto-link/create team_member on first login
  3. Adds user_id to ai_chat_sessions for per-user chat history
  4. Adds audit columns (created_by, last_modified_by) to projects
  5. Replaces all USING(true) RLS policies with authenticated-only access
  6. Updates ai_chat_sessions policies to use user_id = auth.uid()

  ## Security Note
  After this migration, only authenticated users (Google OAuth via Supabase Auth)
  can access any data. Anonymous access is fully blocked.
*/

-- ============================================================================
-- PART 1: Link team_members to auth.users
-- ============================================================================

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_auth_user_id
  ON team_members(auth_user_id);

-- ============================================================================
-- PART 2: Auto-link trigger for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a team_member with this email exists, link it
  UPDATE team_members
  SET auth_user_id = NEW.id
  WHERE email = NEW.email
    AND auth_user_id IS NULL;

  -- If no team_member was found, create one
  IF NOT FOUND THEN
    INSERT INTO team_members (name, email, auth_user_id, is_active, display_order)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.id,
      true,
      (SELECT COALESCE(MAX(display_order), 0) + 1 FROM team_members)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 3: Add user_id to ai_chat_sessions
-- ============================================================================

ALTER TABLE ai_chat_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id
  ON ai_chat_sessions(user_id, created_at DESC);

-- ============================================================================
-- PART 4: Add audit columns to projects
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by_member_id);
CREATE INDEX IF NOT EXISTS idx_projects_last_modified_by ON projects(last_modified_by_member_id);

-- ============================================================================
-- PART 5: Replace all USING(true) RLS policies with authenticated-only access
-- ============================================================================

-- Helper: For each table, drop old open policy then create authenticated-only policy.

-- ----- area_cabinets -----
DROP POLICY IF EXISTS "Allow all operations on area_cabinets" ON area_cabinets;
CREATE POLICY "Authenticated users full access on area_cabinets"
  ON area_cabinets FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- area_countertops -----
DROP POLICY IF EXISTS "Allow all operations on area_countertops" ON area_countertops;
CREATE POLICY "Authenticated users full access on area_countertops"
  ON area_countertops FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- area_items -----
DROP POLICY IF EXISTS "Allow all operations on area_items" ON area_items;
CREATE POLICY "Authenticated users full access on area_items"
  ON area_items FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- area_closet_items -----
DROP POLICY IF EXISTS "Allow anon full access" ON area_closet_items;
DROP POLICY IF EXISTS "Allow authenticated full access" ON area_closet_items;
CREATE POLICY "Authenticated users full access on area_closet_items"
  ON area_closet_items FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- area_sections -----
DROP POLICY IF EXISTS "Allow all operations on area_sections" ON area_sections;
CREATE POLICY "Authenticated users full access on area_sections"
  ON area_sections FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- cabinet_templates -----
DROP POLICY IF EXISTS "Allow all operations on cabinet_templates" ON cabinet_templates;
CREATE POLICY "Authenticated users full access on cabinet_templates"
  ON cabinet_templates FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- closet_catalog -----
DROP POLICY IF EXISTS "Allow anon full access" ON closet_catalog;
DROP POLICY IF EXISTS "Allow authenticated full access" ON closet_catalog;
CREATE POLICY "Authenticated users full access on closet_catalog"
  ON closet_catalog FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- custom_types -----
DROP POLICY IF EXISTS "Allow all operations on custom_types" ON custom_types;
CREATE POLICY "Authenticated users full access on custom_types"
  ON custom_types FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- custom_units -----
DROP POLICY IF EXISTS "Allow all operations on custom_units" ON custom_units;
CREATE POLICY "Authenticated users full access on custom_units"
  ON custom_units FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- material_change_log -----
DROP POLICY IF EXISTS "Allow public read access to material_change_log" ON material_change_log;
DROP POLICY IF EXISTS "Allow public insert access to material_change_log" ON material_change_log;
DROP POLICY IF EXISTS "Allow public update access to material_change_log" ON material_change_log;
DROP POLICY IF EXISTS "Allow public delete access to material_change_log" ON material_change_log;
CREATE POLICY "Authenticated users full access on material_change_log"
  ON material_change_log FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- price_change_log -----
DROP POLICY IF EXISTS "Allow all operations on price_change_log" ON price_change_log;
CREATE POLICY "Authenticated users full access on price_change_log"
  ON price_change_log FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- price_list -----
DROP POLICY IF EXISTS "Allow all operations on price_list" ON price_list;
CREATE POLICY "Authenticated users full access on price_list"
  ON price_list FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- products_catalog -----
DROP POLICY IF EXISTS "Allow all operations on products_catalog" ON products_catalog;
CREATE POLICY "Authenticated users full access on products_catalog"
  ON products_catalog FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_areas -----
DROP POLICY IF EXISTS "Allow all operations on project_areas" ON project_areas;
CREATE POLICY "Authenticated users full access on project_areas"
  ON project_areas FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_price_staleness -----
DROP POLICY IF EXISTS "Allow all operations on project_price_staleness" ON project_price_staleness;
CREATE POLICY "Authenticated users full access on project_price_staleness"
  ON project_price_staleness FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_version_details -----
DROP POLICY IF EXISTS "Allow all operations on project_version_details" ON project_version_details;
CREATE POLICY "Authenticated users full access on project_version_details"
  ON project_version_details FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_versions -----
DROP POLICY IF EXISTS "Allow all operations on project_versions" ON project_versions;
CREATE POLICY "Authenticated users full access on project_versions"
  ON project_versions FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- projects -----
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;
CREATE POLICY "Authenticated users full access on projects"
  ON projects FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- settings -----
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
CREATE POLICY "Authenticated users full access on settings"
  ON settings FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- taxes_by_type -----
DROP POLICY IF EXISTS "Allow all operations on taxes_by_type" ON taxes_by_type;
CREATE POLICY "Authenticated users full access on taxes_by_type"
  ON taxes_by_type FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- template_usage_log -----
DROP POLICY IF EXISTS "Allow all operations on template_usage_log" ON template_usage_log;
CREATE POLICY "Authenticated users full access on template_usage_log"
  ON template_usage_log FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- team_members -----
DROP POLICY IF EXISTS "Allow all operations on team_members" ON team_members;
CREATE POLICY "Authenticated users full access on team_members"
  ON team_members FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_documents -----
DROP POLICY IF EXISTS "Allow all operations on project_documents" ON project_documents;
CREATE POLICY "Authenticated users full access on project_documents"
  ON project_documents FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_tasks -----
DROP POLICY IF EXISTS "Allow all operations on project_tasks" ON project_tasks;
CREATE POLICY "Authenticated users full access on project_tasks"
  ON project_tasks FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_activities -----
DROP POLICY IF EXISTS "Allow all operations on project_activities" ON project_activities;
CREATE POLICY "Authenticated users full access on project_activities"
  ON project_activities FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_logs -----
DROP POLICY IF EXISTS "Allow all operations on project_logs" ON project_logs;
CREATE POLICY "Authenticated users full access on project_logs"
  ON project_logs FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- project_log_replies -----
DROP POLICY IF EXISTS "Allow all on project_log_replies" ON project_log_replies;
CREATE POLICY "Authenticated users full access on project_log_replies"
  ON project_log_replies FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_assignees -----
DROP POLICY IF EXISTS "Allow all on task_assignees" ON task_assignees;
CREATE POLICY "Authenticated users full access on task_assignees"
  ON task_assignees FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_tags -----
DROP POLICY IF EXISTS "Allow all on task_tags" ON task_tags;
CREATE POLICY "Authenticated users full access on task_tags"
  ON task_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_tag_assignments -----
DROP POLICY IF EXISTS "Allow all on task_tag_assignments" ON task_tag_assignments;
CREATE POLICY "Authenticated users full access on task_tag_assignments"
  ON task_tag_assignments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_comments -----
DROP POLICY IF EXISTS "Allow all on task_comments" ON task_comments;
CREATE POLICY "Authenticated users full access on task_comments"
  ON task_comments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_comment_replies -----
DROP POLICY IF EXISTS "Allow all on task_comment_replies" ON task_comment_replies;
CREATE POLICY "Authenticated users full access on task_comment_replies"
  ON task_comment_replies FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- task_deliverables -----
DROP POLICY IF EXISTS "Allow all on task_deliverables" ON task_deliverables;
CREATE POLICY "Authenticated users full access on task_deliverables"
  ON task_deliverables FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- version_project_areas -----
DROP POLICY IF EXISTS "Allow public read access to version_project_areas" ON version_project_areas;
DROP POLICY IF EXISTS "Allow public insert access to version_project_areas" ON version_project_areas;
DROP POLICY IF EXISTS "Allow public update access to version_project_areas" ON version_project_areas;
DROP POLICY IF EXISTS "Allow public delete access to version_project_areas" ON version_project_areas;
CREATE POLICY "Authenticated users full access on version_project_areas"
  ON version_project_areas FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- version_area_cabinets -----
DROP POLICY IF EXISTS "Allow public read access to version_area_cabinets" ON version_area_cabinets;
DROP POLICY IF EXISTS "Allow public insert access to version_area_cabinets" ON version_area_cabinets;
DROP POLICY IF EXISTS "Allow public update access to version_area_cabinets" ON version_area_cabinets;
DROP POLICY IF EXISTS "Allow public delete access to version_area_cabinets" ON version_area_cabinets;
CREATE POLICY "Authenticated users full access on version_area_cabinets"
  ON version_area_cabinets FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- version_area_items -----
DROP POLICY IF EXISTS "Allow public read access to version_area_items" ON version_area_items;
DROP POLICY IF EXISTS "Allow public insert access to version_area_items" ON version_area_items;
DROP POLICY IF EXISTS "Allow public update access to version_area_items" ON version_area_items;
DROP POLICY IF EXISTS "Allow public delete access to version_area_items" ON version_area_items;
CREATE POLICY "Authenticated users full access on version_area_items"
  ON version_area_items FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ----- version_area_countertops -----
DROP POLICY IF EXISTS "Allow public read access to version_area_countertops" ON version_area_countertops;
DROP POLICY IF EXISTS "Allow public insert access to version_area_countertops" ON version_area_countertops;
DROP POLICY IF EXISTS "Allow public delete access to version_area_countertops" ON version_area_countertops;
CREATE POLICY "Authenticated users full access on version_area_countertops"
  ON version_area_countertops FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 6: Replace ai_chat_sessions policies (user_id-based)
-- ============================================================================

DROP POLICY IF EXISTS "Anon can insert own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Anon can select own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Anon can update own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Anon can delete own sessions" ON ai_chat_sessions;

CREATE POLICY "Users can view own chat sessions"
  ON ai_chat_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat sessions"
  ON ai_chat_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat sessions"
  ON ai_chat_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat sessions"
  ON ai_chat_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
