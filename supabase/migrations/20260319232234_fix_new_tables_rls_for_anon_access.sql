/*
  # Fix RLS Policies for New Management Tables

  ## Problem
  The 5 new tables (team_members, project_documents, project_tasks,
  project_activities, project_logs) were created with policies scoped
  TO authenticated, but this application uses the anon role for all
  Supabase client requests (localStorage-based auth, not Supabase Auth).
  This caused all inserts/updates/deletes to be silently rejected.

  ## Solution
  Drop the authenticated-only policies and replace with public/anon-accessible
  FOR ALL policies, matching the pattern used by every other table in this project.
*/

-- team_members
DROP POLICY IF EXISTS "Authenticated users can view team members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can insert team members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can update team members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can delete team members" ON team_members;

CREATE POLICY "Allow all operations on team_members"
  ON team_members FOR ALL
  USING (true)
  WITH CHECK (true);

-- project_documents
DROP POLICY IF EXISTS "Authenticated users can view project documents" ON project_documents;
DROP POLICY IF EXISTS "Authenticated users can insert project documents" ON project_documents;
DROP POLICY IF EXISTS "Authenticated users can update project documents" ON project_documents;
DROP POLICY IF EXISTS "Authenticated users can delete project documents" ON project_documents;

CREATE POLICY "Allow all operations on project_documents"
  ON project_documents FOR ALL
  USING (true)
  WITH CHECK (true);

-- project_tasks
DROP POLICY IF EXISTS "Authenticated users can view project tasks" ON project_tasks;
DROP POLICY IF EXISTS "Authenticated users can insert project tasks" ON project_tasks;
DROP POLICY IF EXISTS "Authenticated users can update project tasks" ON project_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete project tasks" ON project_tasks;

CREATE POLICY "Allow all operations on project_tasks"
  ON project_tasks FOR ALL
  USING (true)
  WITH CHECK (true);

-- project_activities
DROP POLICY IF EXISTS "Authenticated users can view project activities" ON project_activities;
DROP POLICY IF EXISTS "Authenticated users can insert project activities" ON project_activities;
DROP POLICY IF EXISTS "Authenticated users can update project activities" ON project_activities;
DROP POLICY IF EXISTS "Authenticated users can delete project activities" ON project_activities;

CREATE POLICY "Allow all operations on project_activities"
  ON project_activities FOR ALL
  USING (true)
  WITH CHECK (true);

-- project_logs
DROP POLICY IF EXISTS "Authenticated users can view project logs" ON project_logs;
DROP POLICY IF EXISTS "Authenticated users can insert project logs" ON project_logs;
DROP POLICY IF EXISTS "Authenticated users can update project logs" ON project_logs;
DROP POLICY IF EXISTS "Authenticated users can delete project logs" ON project_logs;

CREATE POLICY "Allow all operations on project_logs"
  ON project_logs FOR ALL
  USING (true)
  WITH CHECK (true);