/*
  # Bulk Material Change System

  This migration creates the infrastructure for bulk material changes across cabinets.

  ## New Tables

  ### material_change_log
  Audit table to track all bulk material change operations:
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key to projects)
  - `user_action` (text) - description of the action
  - `change_type` (text) - type of material changed (box_material, doors_material, etc)
  - `scope` (text) - scope of change (area, project, selected_areas)
  - `scope_details` (jsonb) - area IDs affected
  - `affected_cabinets_count` (integer) - number of cabinets updated
  - `old_material_id` (uuid, foreign key to price_list)
  - `new_material_id` (uuid, foreign key to price_list)
  - `old_material_name` (text) - snapshot of old material name
  - `new_material_name` (text) - snapshot of new material name
  - `cost_before` (decimal) - total cost before change
  - `cost_after` (decimal) - total cost after change
  - `cost_difference` (decimal) - calculated difference
  - `created_at` (timestamptz)

  ## Indexes
  Performance indexes for efficient material lookup queries:
  - Composite indexes on area_cabinets material columns with area_id
  - Composite indexes on version_area_cabinets material columns with area_id
  - Index on material_change_log for project lookups

  ## Security
  - RLS enabled on material_change_log table
  - Public access policies (can be restricted later)
*/

-- ============================================================================
-- MATERIAL CHANGE LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS material_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_action TEXT NOT NULL,
  change_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_details JSONB DEFAULT '[]',
  affected_cabinets_count INTEGER NOT NULL DEFAULT 0,
  old_material_id UUID REFERENCES price_list(id) ON DELETE SET NULL,
  new_material_id UUID REFERENCES price_list(id) ON DELETE SET NULL,
  old_material_name TEXT,
  new_material_name TEXT,
  cost_before DECIMAL(12,2) DEFAULT 0,
  cost_after DECIMAL(12,2) DEFAULT 0,
  cost_difference DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_change_log_project
  ON material_change_log(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_material_change_log_change_type
  ON material_change_log(change_type);

-- Enable RLS
ALTER TABLE material_change_log ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read access to material_change_log"
  ON material_change_log FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to material_change_log"
  ON material_change_log FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to material_change_log"
  ON material_change_log FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to material_change_log"
  ON material_change_log FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- PERFORMANCE INDEXES FOR BULK MATERIAL QUERIES
-- ============================================================================

-- Indexes for area_cabinets table to speed up material lookups
CREATE INDEX IF NOT EXISTS idx_area_cabinets_box_material_area
  ON area_cabinets(box_material_id, area_id)
  WHERE box_material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_area_cabinets_doors_material_area
  ON area_cabinets(doors_material_id, area_id)
  WHERE doors_material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_area_cabinets_box_edgeband_area
  ON area_cabinets(box_edgeband_id, area_id)
  WHERE box_edgeband_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_area_cabinets_doors_edgeband_area
  ON area_cabinets(doors_edgeband_id, area_id)
  WHERE doors_edgeband_id IS NOT NULL;

-- Indexes for version_area_cabinets table
CREATE INDEX IF NOT EXISTS idx_version_cabinets_box_material_area
  ON version_area_cabinets(box_material_id, area_id)
  WHERE box_material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_version_cabinets_doors_material_area
  ON version_area_cabinets(doors_material_id, area_id)
  WHERE doors_material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_version_cabinets_box_edgeband_area
  ON version_area_cabinets(box_edgeband_id, area_id)
  WHERE box_edgeband_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_version_cabinets_doors_edgeband_area
  ON version_area_cabinets(doors_edgeband_id, area_id)
  WHERE doors_edgeband_id IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE material_change_log IS 'Audit log for bulk material change operations across cabinets';
COMMENT ON COLUMN material_change_log.scope IS 'Scope of change: area, project, or selected_areas';
COMMENT ON COLUMN material_change_log.scope_details IS 'JSONB array of area IDs affected by the change';
COMMENT ON COLUMN material_change_log.change_type IS 'Type of material changed: box_material, box_edgeband, doors_material, doors_edgeband, box_interior_finish, doors_interior_finish';
COMMENT ON COLUMN material_change_log.cost_difference IS 'Positive value indicates cost increase, negative indicates reduction';
