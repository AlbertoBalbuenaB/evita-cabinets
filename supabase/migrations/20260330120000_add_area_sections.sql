-- Create area_sections table for visual organization of cabinets within areas
CREATE TABLE area_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES project_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_area_sections_area_id ON area_sections(area_id);
CREATE INDEX idx_area_sections_area_display_order ON area_sections(area_id, display_order);

ALTER TABLE area_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on area_sections"
  ON area_sections FOR ALL
  USING (true)
  WITH CHECK (true);
