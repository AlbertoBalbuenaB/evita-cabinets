-- Evita Takeoff — PR 4: hybrid persistence for takeoff sessions + threaded comments.
--
-- takeoff_sessions:  one row per saved session. project_id is nullable so a session can be
--                    standalone (user just wants a quick estimate) or pinned to a project
--                    (visible under ProjectPage → Takeoffs tab).
-- takeoff_comments:  threaded root/reply comments anchored to PDF-space coordinates. Root
--                    rows carry position_x/y/page; reply rows carry parent_comment_id but
--                    have NULL position (they inherit from root).
--
-- Storage bucket `takeoffs` is created here too (Supabase exposes storage.buckets as a table
-- so the CREATE TABLE path is the cleanest way to keep the whole schema change in one
-- migration file).

CREATE TABLE IF NOT EXISTS takeoff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  pdf_storage_path TEXT NOT NULL,
  pdf_filename TEXT NOT NULL,
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES team_members(id),
  updated_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_sessions_project ON takeoff_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_sessions_created_by ON takeoff_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_takeoff_sessions_updated_at ON takeoff_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS takeoff_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES takeoff_sessions(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES takeoff_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES team_members(id),
  text TEXT NOT NULL,
  position_x DOUBLE PRECISION,
  position_y DOUBLE PRECISION,
  page INTEGER,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES team_members(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_comments_session ON takeoff_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_comments_parent ON takeoff_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_comments_author ON takeoff_comments(author_id);

-- Updated-at trigger for takeoff_sessions so the sessions list can sort by most recent edit.
CREATE OR REPLACE FUNCTION takeoff_sessions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_takeoff_sessions_updated_at ON takeoff_sessions;
CREATE TRIGGER trg_takeoff_sessions_updated_at
  BEFORE UPDATE ON takeoff_sessions
  FOR EACH ROW EXECUTE FUNCTION takeoff_sessions_set_updated_at();

-- RLS — MVP stance: any authenticated team_member can do anything. We can tighten per-project
-- or per-author later without dropping the tables, once usage patterns are clearer.
ALTER TABLE takeoff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "takeoff_sessions_team_members" ON takeoff_sessions;
CREATE POLICY "takeoff_sessions_team_members" ON takeoff_sessions
  FOR ALL
  USING (auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL))
  WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL));

DROP POLICY IF EXISTS "takeoff_comments_team_members" ON takeoff_comments;
CREATE POLICY "takeoff_comments_team_members" ON takeoff_comments
  FOR ALL
  USING (auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL))
  WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL));

-- Storage bucket for the uploaded PDFs / images. Private (not public) — all access goes
-- through signed URLs issued by the app, and only authenticated team members can read/write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('takeoffs', 'takeoffs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "takeoffs_read_team_members" ON storage.objects;
CREATE POLICY "takeoffs_read_team_members" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'takeoffs'
    AND auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "takeoffs_write_team_members" ON storage.objects;
CREATE POLICY "takeoffs_write_team_members" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'takeoffs'
    AND auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'takeoffs'
    AND auth.uid() IN (SELECT auth_user_id FROM team_members WHERE auth_user_id IS NOT NULL)
  );
