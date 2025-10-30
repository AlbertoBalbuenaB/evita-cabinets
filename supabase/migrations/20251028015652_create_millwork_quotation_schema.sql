/*
  # Millwork & Casework Quotation System Database Schema

  ## Overview
  This migration creates the complete database schema for managing cabinet quotations,
  including products catalog, price lists, projects, areas, and detailed cabinet configurations.

  ## Tables Created

  ### 1. products_catalog
  Stores all cabinet SKUs with their specifications:
  - SKU/Code (unique identifier)
  - Description (cabinet type and features)
  - Box square feet and edgeband meters
  - Doors & fronts square feet and edgeband meters
  - Total edgeband meters (used for calculations)
  - Has drawers flag (affects labor cost)

  ### 2. price_list
  Stores all materials, hardware, and their prices:
  - Materials: Melamine, MDF, Plywood, Laminates (price per sheet)
  - Edgeband: Various types and finishes (price per meter)
  - Hardware: Hinges, slides, handles, etc. (price per piece)
  - Dimensions and square feet calculations for sheet materials

  ### 3. projects
  Main project container with name, address, quote date, and total amount

  ### 4. project_areas
  Subdivisions within projects (Kitchen, Dining, Closet, etc.)

  ### 5. area_cabinets
  Individual cabinet entries with complete configuration:
  - Product reference
  - Quantity
  - Box construction materials (material, edgeband, optional interior finish)
  - Doors & fronts materials (material, edgeband, optional interior finish)
  - Hardware items (JSONB array)
  - All calculated costs (materials, labor, subtotal)

  ## Security
  - RLS enabled on all tables
  - Public access policies (authentication can be added later)
  - Indexes for optimal query performance

  ## Important Notes
  - Sheet material prices are PER SHEET, must divide by sq ft for calculations
  - Edgeband prices are PER METER, multiply directly
  - Labor: $600/cabinet with drawers, $400/cabinet without drawers
  - Soft deletes using is_active flag
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PRODUCTS CATALOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS products_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  box_sf DECIMAL(10,2) NOT NULL DEFAULT 0,
  box_edgeband DECIMAL(10,2) DEFAULT 0,
  box_edgeband_color DECIMAL(10,2) DEFAULT 0,
  doors_fronts_sf DECIMAL(10,2) NOT NULL DEFAULT 0,
  doors_fronts_edgeband DECIMAL(10,2) DEFAULT 0,
  total_edgeband DECIMAL(10,2) NOT NULL DEFAULT 0,
  has_drawers BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products_catalog(sku);
CREATE INDEX IF NOT EXISTS idx_products_drawers ON products_catalog(has_drawers);
CREATE INDEX IF NOT EXISTS idx_products_active ON products_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_products_description ON products_catalog USING gin(to_tsvector('english', description));

-- Enable RLS
ALTER TABLE products_catalog ENABLE ROW LEVEL SECURITY;

-- Public access policy (can be restricted later with authentication)
CREATE POLICY "Allow public read access to products_catalog"
  ON products_catalog FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Allow public insert access to products_catalog"
  ON products_catalog FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to products_catalog"
  ON products_catalog FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to products_catalog"
  ON products_catalog FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- PRICE LIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code VARCHAR(100),
  concept_description TEXT NOT NULL,
  type VARCHAR(100) NOT NULL,
  material VARCHAR(100),
  dimensions VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sf_per_sheet DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_type ON price_list(type);
CREATE INDEX IF NOT EXISTS idx_price_material ON price_list(material);
CREATE INDEX IF NOT EXISTS idx_price_active ON price_list(is_active);
CREATE INDEX IF NOT EXISTS idx_price_unit ON price_list(unit);
CREATE INDEX IF NOT EXISTS idx_price_description ON price_list USING gin(to_tsvector('english', concept_description));

-- Enable RLS
ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read access to price_list"
  ON price_list FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Allow public insert access to price_list"
  ON price_list FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to price_list"
  ON price_list FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to price_list"
  ON price_list FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_quote_date ON projects(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects USING gin(to_tsvector('english', name));

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read access to projects"
  ON projects FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to projects"
  ON projects FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to projects"
  ON projects FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to projects"
  ON projects FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- PROJECT AREAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_project ON project_areas(project_id);
CREATE INDEX IF NOT EXISTS idx_areas_order ON project_areas(project_id, display_order);

-- Enable RLS
ALTER TABLE project_areas ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read access to project_areas"
  ON project_areas FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to project_areas"
  ON project_areas FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to project_areas"
  ON project_areas FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to project_areas"
  ON project_areas FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- AREA CABINETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS area_cabinets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES project_areas(id) ON DELETE CASCADE,
  product_sku VARCHAR(100) REFERENCES products_catalog(sku),
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Box Construction
  box_material_id UUID REFERENCES price_list(id),
  box_edgeband_id UUID REFERENCES price_list(id),
  box_interior_finish_id UUID REFERENCES price_list(id),
  
  -- Doors & Drawer Fronts
  doors_material_id UUID REFERENCES price_list(id),
  doors_edgeband_id UUID REFERENCES price_list(id),
  doors_interior_finish_id UUID REFERENCES price_list(id),
  
  -- Hardware (JSON array of {hardware_id, quantity_per_cabinet})
  hardware JSONB DEFAULT '[]',
  
  -- Calculated costs
  box_material_cost DECIMAL(10,2) DEFAULT 0,
  box_edgeband_cost DECIMAL(10,2) DEFAULT 0,
  box_interior_finish_cost DECIMAL(10,2) DEFAULT 0,
  doors_material_cost DECIMAL(10,2) DEFAULT 0,
  doors_edgeband_cost DECIMAL(10,2) DEFAULT 0,
  doors_interior_finish_cost DECIMAL(10,2) DEFAULT 0,
  hardware_cost DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinets_area ON area_cabinets(area_id);
CREATE INDEX IF NOT EXISTS idx_cabinets_product ON area_cabinets(product_sku);

-- Enable RLS
ALTER TABLE area_cabinets ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read access to area_cabinets"
  ON area_cabinets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to area_cabinets"
  ON area_cabinets FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to area_cabinets"
  ON area_cabinets FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to area_cabinets"
  ON area_cabinets FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_catalog_updated_at
  BEFORE UPDATE ON products_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_list_updated_at
  BEFORE UPDATE ON price_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
