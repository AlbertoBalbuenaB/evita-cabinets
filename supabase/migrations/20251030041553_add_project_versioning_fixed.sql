-- ============================================================================
-- PROJECT VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  version_name TEXT NOT NULL,
  is_current BOOLEAN DEFAULT false,
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  based_on_version_id UUID REFERENCES project_versions(id) ON DELETE SET NULL,
  UNIQUE(project_id, version_number),
  UNIQUE(project_id, version_name)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_current ON project_versions(project_id, is_current);
CREATE INDEX IF NOT EXISTS idx_project_versions_created ON project_versions(created_at DESC);

-- Enable RLS
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to project_versions"
  ON project_versions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to project_versions"
  ON project_versions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to project_versions"
  ON project_versions FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to project_versions"
  ON project_versions FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- VERSION PROJECT AREAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS version_project_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_areas_version ON version_project_areas(version_id);
CREATE INDEX IF NOT EXISTS idx_version_areas_order ON version_project_areas(version_id, display_order);

-- Enable RLS
ALTER TABLE version_project_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to version_project_areas"
  ON version_project_areas FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to version_project_areas"
  ON version_project_areas FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to version_project_areas"
  ON version_project_areas FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to version_project_areas"
  ON version_project_areas FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- VERSION AREA CABINETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS version_area_cabinets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES version_project_areas(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products_catalog(id),
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Box materials
  box_material_id UUID REFERENCES price_list(id),
  box_material_name TEXT,
  box_material_cost DECIMAL(10,2) DEFAULT 0,
  box_edgeband_id UUID REFERENCES price_list(id),
  box_edgeband_name TEXT,
  box_edgeband_cost DECIMAL(10,2) DEFAULT 0,
  box_interior_finish_id UUID REFERENCES price_list(id),
  box_interior_finish_name TEXT,
  box_interior_finish_cost DECIMAL(10,2) DEFAULT 0,

  -- Doors/Fronts materials
  doors_material_id UUID REFERENCES price_list(id),
  doors_material_name TEXT,
  doors_material_cost DECIMAL(10,2) DEFAULT 0,
  doors_edgeband_id UUID REFERENCES price_list(id),
  doors_edgeband_name TEXT,
  doors_edgeband_cost DECIMAL(10,2) DEFAULT 0,
  doors_interior_finish_id UUID REFERENCES price_list(id),
  doors_interior_finish_name TEXT,
  doors_interior_finish_cost DECIMAL(10,2) DEFAULT 0,

  -- Hardware
  hardware JSONB DEFAULT '[]',
  hardware_cost DECIMAL(10,2) DEFAULT 0,

  -- Costs
  labor_cost DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,

  -- Product snapshot (for version isolation)
  product_sku TEXT,
  product_description TEXT,
  box_sf DECIMAL(10,2),
  doors_fronts_sf DECIMAL(10,2),
  total_edgeband DECIMAL(10,2),
  has_drawers BOOLEAN DEFAULT false,

  -- RTA flag
  is_rta BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_cabinets_area ON version_area_cabinets(area_id);
CREATE INDEX IF NOT EXISTS idx_version_cabinets_product ON version_area_cabinets(product_id);

-- Enable RLS
ALTER TABLE version_area_cabinets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to version_area_cabinets"
  ON version_area_cabinets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to version_area_cabinets"
  ON version_area_cabinets FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to version_area_cabinets"
  ON version_area_cabinets FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to version_area_cabinets"
  ON version_area_cabinets FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- VERSION AREA ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS version_area_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES version_project_areas(id) ON DELETE CASCADE,
  price_list_item_id UUID NOT NULL REFERENCES price_list(id),
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_items_area ON version_area_items(area_id);
CREATE INDEX IF NOT EXISTS idx_version_items_price_list ON version_area_items(price_list_item_id);

-- Enable RLS
ALTER TABLE version_area_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to version_area_items"
  ON version_area_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to version_area_items"
  ON version_area_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to version_area_items"
  ON version_area_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to version_area_items"
  ON version_area_items FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- MIGRATION: CREATE INITIAL VERSIONS FOR EXISTING PROJECTS
-- ============================================================================

-- Create v1.0 version for each existing project
INSERT INTO project_versions (project_id, version_number, version_name, is_current, notes, total_amount, created_at)
SELECT
  id,
  'v1.0',
  'Initial Version',
  true,
  'Automatically created during migration',
  total_amount,
  created_at
FROM projects
WHERE NOT EXISTS (
  SELECT 1 FROM project_versions WHERE project_versions.project_id = projects.id
);

-- Migrate existing project_areas to version_project_areas
INSERT INTO version_project_areas (id, version_id, name, display_order, subtotal, created_at)
SELECT
  pa.id,
  pv.id as version_id,
  pa.name,
  pa.display_order,
  pa.subtotal,
  pa.created_at
FROM project_areas pa
INNER JOIN project_versions pv ON pv.project_id = pa.project_id AND pv.version_number = 'v1.0'
WHERE NOT EXISTS (
  SELECT 1 FROM version_project_areas WHERE version_project_areas.id = pa.id
);

-- Migrate existing area_cabinets to version_area_cabinets
-- Using INNER JOIN with products_catalog to get product_id from product_sku
INSERT INTO version_area_cabinets (
  id, area_id, product_id, quantity,
  box_material_id, box_material_name, box_material_cost,
  box_edgeband_id, box_edgeband_name, box_edgeband_cost,
  box_interior_finish_id, box_interior_finish_name, box_interior_finish_cost,
  doors_material_id, doors_material_name, doors_material_cost,
  doors_edgeband_id, doors_edgeband_name, doors_edgeband_cost,
  doors_interior_finish_id, doors_interior_finish_name, doors_interior_finish_cost,
  hardware, hardware_cost, labor_cost, subtotal,
  product_sku, product_description, box_sf, doors_fronts_sf, total_edgeband, has_drawers, is_rta,
  created_at, updated_at
)
SELECT
  ac.id, ac.area_id, p.id as product_id, ac.quantity,
  ac.box_material_id, NULL, ac.box_material_cost,
  ac.box_edgeband_id, NULL, ac.box_edgeband_cost,
  ac.box_interior_finish_id, NULL, ac.box_interior_finish_cost,
  ac.doors_material_id, NULL, ac.doors_material_cost,
  ac.doors_edgeband_id, NULL, ac.doors_edgeband_cost,
  ac.doors_interior_finish_id, NULL, ac.doors_interior_finish_cost,
  ac.hardware, ac.hardware_cost, ac.labor_cost, ac.subtotal,
  ac.product_sku, p.description, p.box_sf, p.doors_fronts_sf, p.total_edgeband, p.has_drawers, ac.is_rta,
  ac.created_at, NOW()
FROM area_cabinets ac
INNER JOIN products_catalog p ON p.sku = ac.product_sku
WHERE EXISTS (
  SELECT 1 FROM version_project_areas vpa WHERE vpa.id = ac.area_id
)
AND NOT EXISTS (
  SELECT 1 FROM version_area_cabinets WHERE version_area_cabinets.id = ac.id
);

-- Migrate existing area_items to version_area_items
INSERT INTO version_area_items (
  id, area_id, price_list_item_id, item_name, quantity, unit_price, subtotal, notes, created_at, updated_at
)
SELECT
  ai.id, ai.area_id, ai.price_list_item_id, ai.item_name, ai.quantity, ai.unit_price, ai.subtotal, ai.notes, ai.created_at, ai.updated_at
FROM area_items ai
WHERE EXISTS (
  SELECT 1 FROM version_project_areas vpa WHERE vpa.id = ai.area_id
)
AND NOT EXISTS (
  SELECT 1 FROM version_area_items WHERE version_area_items.id = ai.id
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to ensure only one current version per project
CREATE OR REPLACE FUNCTION ensure_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE project_versions
    SET is_current = false
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_current_version
  BEFORE INSERT OR UPDATE ON project_versions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_version();

-- Function to update project total_amount when version changes
CREATE OR REPLACE FUNCTION update_project_total_from_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE projects
    SET total_amount = NEW.total_amount,
        updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_total
  AFTER INSERT OR UPDATE ON project_versions
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION update_project_total_from_version();

-- Add comments
COMMENT ON TABLE project_versions IS 'Stores different versions of a project for comparison and history tracking';
COMMENT ON TABLE version_project_areas IS 'Project areas specific to each version';
COMMENT ON TABLE version_area_cabinets IS 'Cabinet configurations specific to each version';
COMMENT ON TABLE version_area_items IS 'Additional items specific to each version';

COMMENT ON COLUMN project_versions.is_current IS 'Only one version per project can be marked as current';
COMMENT ON COLUMN project_versions.based_on_version_id IS 'Reference to parent version if this was created by duplication';
COMMENT ON COLUMN version_area_cabinets.product_sku IS 'Snapshot of product data for version isolation';
