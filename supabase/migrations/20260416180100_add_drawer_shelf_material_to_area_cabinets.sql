-- Add drawer box and shelf material fields to area_cabinets
-- Follows the same pattern as back_panel_material: toggle + material FK + cost
-- Applied via MCP apply_migration on 2026-04-16

ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS use_drawer_box_material boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS drawer_box_material_id uuid REFERENCES price_list(id),
  ADD COLUMN IF NOT EXISTS drawer_box_material_cost numeric DEFAULT 0;

ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS use_shelf_material boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shelf_material_id uuid REFERENCES price_list(id),
  ADD COLUMN IF NOT EXISTS shelf_material_cost numeric DEFAULT 0;

-- Extra shelves: user can add shelves beyond the product template default
ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS extra_shelves integer DEFAULT 0;

-- Edgeband fields for drawer box and shelf (Phase 2 cubrecanto codes)
ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS drawer_box_edgeband_id uuid REFERENCES price_list(id),
  ADD COLUMN IF NOT EXISTS drawer_box_edgeband_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shelf_edgeband_id uuid REFERENCES price_list(id),
  ADD COLUMN IF NOT EXISTS shelf_edgeband_cost numeric DEFAULT 0;
