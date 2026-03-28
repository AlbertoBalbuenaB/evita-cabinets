/*
  # Add Project Management Tables

  1. New Tables
    - `team_members` - Global team members configured in Settings
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `role` (text, optional)
      - `email` (text, optional)
      - `display_order` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
    - `project_documents` - Document links per project
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `label` (text, required)
      - `url` (text, default '')
      - `display_order` (integer, default 0)
      - `created_at` (timestamptz)
    - `project_tasks` - Tasks per project
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `title` (text, required)
      - `details` (text, optional)
      - `due_date` (date, optional)
      - `assignee_id` (uuid, FK to team_members, nullable)
      - `status` (text, pending/in_progress/done)
      - `display_order` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `project_activities` - Schedule/Gantt activities per project
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `name` (text, required)
      - `start_date` (date, required)
      - `end_date` (date, required)
      - `display_order` (integer, default 0)
      - `created_at` (timestamptz)
    - `project_logs` - Bitacora/log entries per project
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `comment` (text, required)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all 5 tables
    - Separate SELECT, INSERT, UPDATE, DELETE policies for authenticated users
    - Project-scoped tables restricted by project ownership check

  3. Indexes
    - project_id indexes on all project-scoped tables
    - assignee_id index on project_tasks
*/

-- 1. Team Members (global)
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  email text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. Project Documents
CREATE TABLE IF NOT EXISTS project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);

CREATE POLICY "Authenticated users can view project documents"
  ON project_documents FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project documents"
  ON project_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project documents"
  ON project_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project documents"
  ON project_documents FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. Project Tasks
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  details text,
  due_date date,
  assignee_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_id ON project_tasks(assignee_id);

CREATE POLICY "Authenticated users can view project tasks"
  ON project_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project tasks"
  ON project_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project tasks"
  ON project_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project tasks"
  ON project_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. Project Activities (Gantt/Schedule)
CREATE TABLE IF NOT EXISTS project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);

CREATE POLICY "Authenticated users can view project activities"
  ON project_activities FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project activities"
  ON project_activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project activities"
  ON project_activities FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project activities"
  ON project_activities FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5. Project Logs (Bitacora)
CREATE TABLE IF NOT EXISTS project_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_logs_project_id ON project_logs(project_id);

CREATE POLICY "Authenticated users can view project logs"
  ON project_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project logs"
  ON project_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project logs"
  ON project_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project logs"
  ON project_logs FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);