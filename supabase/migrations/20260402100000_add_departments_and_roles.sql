-- ============================================================================
-- PART 1: Create departments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access on departments" ON departments;
CREATE POLICY "Authenticated full access on departments"
  ON departments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 2: Seed departments
-- ============================================================================

INSERT INTO departments (name, slug, display_order) VALUES
  ('Sales & Estimating',        'sales-estimating',        1),
  ('Project Management',        'project-management',      2),
  ('Design',                    'design',                  3),
  ('Engineering',               'engineering',             4),
  ('Purchasing & Procurement',  'purchasing-procurement',  5),
  ('Manufacturing',             'manufacturing',           6),
  ('Quality Control',           'quality-control',         7),
  ('Logistics',                 'logistics',               8),
  ('Administration',            'administration',          9),
  ('Finance & HR',              'finance-hr',             10)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PART 3: Add department_id and job_title to team_members
-- ============================================================================

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title text;

CREATE INDEX IF NOT EXISTS idx_team_members_department ON team_members(department_id);

-- ============================================================================
-- PART 4: Normalize roles and add CHECK constraint
-- ============================================================================

-- Map existing values to the new role set
UPDATE team_members SET role = 'collaborator' WHERE role IS NULL OR role = '' OR role = 'user';
UPDATE team_members SET role = 'collaborator' WHERE role NOT IN ('admin', 'collaborator');

ALTER TABLE team_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE team_members ALTER COLUMN role SET DEFAULT 'collaborator';

ALTER TABLE team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('admin','ceo','coo','team_manager','team_leader','specialist','collaborator','assistant'));

-- ============================================================================
-- PART 5: Update handle_new_user trigger to set role explicitly
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
    INSERT INTO team_members (name, email, auth_user_id, role, is_active, display_order)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.id,
      'collaborator',
      true,
      (SELECT COALESCE(MAX(display_order), 0) + 1 FROM team_members)
    );
  END IF;

  RETURN NEW;
END;
$$;
