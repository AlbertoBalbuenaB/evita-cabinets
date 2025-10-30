/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses security and performance issues identified in the database:
  1. Adds missing indexes for foreign keys
  2. Removes unused indexes that add unnecessary overhead
  3. Fixes function search path mutability issues

  ## Changes

  ### 1. Add Missing Foreign Key Indexes
  
  #### area_cabinets table:
  - `box_edgeband_id` - Index for foreign key to price_list
  - `box_interior_finish_id` - Index for foreign key to price_list
  - `box_material_id` - Index for foreign key to price_list
  - `doors_edgeband_id` - Index for foreign key to price_list
  - `doors_interior_finish_id` - Index for foreign key to price_list
  - `doors_material_id` - Index for foreign key to price_list

  #### version_area_cabinets table:
  - `box_edgeband_id` - Index for foreign key to price_list
  - `box_interior_finish_id` - Index for foreign key to price_list
  - `box_material_id` - Index for foreign key to price_list
  - `doors_edgeband_id` - Index for foreign key to price_list
  - `doors_interior_finish_id` - Index for foreign key to price_list
  - `doors_material_id` - Index for foreign key to price_list

  #### project_versions table:
  - `based_on_version_id` - Index for self-referencing foreign key

  ### 2. Remove Unused Indexes
  
  Removes indexes that have not been used and add unnecessary overhead:
  - Project table indexes (name, project_type, expenses, taxes, status, details)
  - Project areas index
  - Price list indexes (tax_rate, prices, material, unit, description)
  - Area cabinets is_rta index
  - Products catalog indexes (drawers, description)
  - Area items index
  - Version-related indexes (project, created, version, product, price_list)

  ### 3. Fix Function Search Path Issues
  
  Recreates functions with immutable search_path to prevent security issues:
  - `ensure_single_current_version` - Version control trigger
  - `update_project_total_from_version` - Total calculation trigger
  - `update_updated_at_column` - Timestamp update trigger

  ## Security Notes
  - All foreign keys now have covering indexes for optimal query performance
  - Functions now use explicit schema qualification to prevent search_path attacks
  - Removed unused indexes reduce maintenance overhead and improve write performance
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Indexes for area_cabinets foreign keys
CREATE INDEX IF NOT EXISTS idx_area_cabinets_box_edgeband 
  ON area_cabinets(box_edgeband_id);

CREATE INDEX IF NOT EXISTS idx_area_cabinets_box_interior_finish 
  ON area_cabinets(box_interior_finish_id);

CREATE INDEX IF NOT EXISTS idx_area_cabinets_box_material 
  ON area_cabinets(box_material_id);

CREATE INDEX IF NOT EXISTS idx_area_cabinets_doors_edgeband 
  ON area_cabinets(doors_edgeband_id);

CREATE INDEX IF NOT EXISTS idx_area_cabinets_doors_interior_finish 
  ON area_cabinets(doors_interior_finish_id);

CREATE INDEX IF NOT EXISTS idx_area_cabinets_doors_material 
  ON area_cabinets(doors_material_id);

-- Indexes for version_area_cabinets foreign keys
CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_box_edgeband 
  ON version_area_cabinets(box_edgeband_id);

CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_box_interior_finish 
  ON version_area_cabinets(box_interior_finish_id);

CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_box_material 
  ON version_area_cabinets(box_material_id);

CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_doors_edgeband 
  ON version_area_cabinets(doors_edgeband_id);

CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_doors_interior_finish 
  ON version_area_cabinets(doors_interior_finish_id);

CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_doors_material 
  ON version_area_cabinets(doors_material_id);

-- Index for project_versions self-referencing foreign key
CREATE INDEX IF NOT EXISTS idx_project_versions_based_on 
  ON project_versions(based_on_version_id);

-- ============================================================================
-- PART 2: REMOVE UNUSED INDEXES
-- ============================================================================

-- Projects table unused indexes
DROP INDEX IF EXISTS idx_projects_name;
DROP INDEX IF EXISTS idx_projects_project_type;
DROP INDEX IF EXISTS idx_projects_other_expenses;
DROP INDEX IF EXISTS idx_projects_taxes_percentage;
DROP INDEX IF EXISTS idx_projects_install_delivery;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_details;

-- Project areas unused index
DROP INDEX IF EXISTS idx_areas_project;

-- Price list unused indexes
DROP INDEX IF EXISTS idx_price_list_tax_rate;
DROP INDEX IF EXISTS idx_price_list_base_price;
DROP INDEX IF EXISTS idx_price_list_price_with_tax;
DROP INDEX IF EXISTS idx_price_material;
DROP INDEX IF EXISTS idx_price_unit;
DROP INDEX IF EXISTS idx_price_description;

-- Area cabinets unused index
DROP INDEX IF EXISTS idx_area_cabinets_is_rta;

-- Products catalog unused indexes
DROP INDEX IF EXISTS idx_products_drawers;
DROP INDEX IF EXISTS idx_products_description;

-- Area items unused index
DROP INDEX IF EXISTS idx_area_items_price_list_item_id;

-- Version tables unused indexes
DROP INDEX IF EXISTS idx_project_versions_project;
DROP INDEX IF EXISTS idx_project_versions_created;
DROP INDEX IF EXISTS idx_version_areas_version;
DROP INDEX IF EXISTS idx_version_cabinets_product;
DROP INDEX IF EXISTS idx_version_items_price_list;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATH ISSUES
-- ============================================================================

-- Drop and recreate ensure_single_current_version function with fixed search_path
DROP FUNCTION IF EXISTS ensure_single_current_version() CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_single_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.project_versions
    SET is_current = false
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS ensure_single_current_version_trigger ON project_versions;
CREATE TRIGGER ensure_single_current_version_trigger
  BEFORE INSERT OR UPDATE ON project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_current_version();

-- Drop and recreate update_project_total_from_version function with fixed search_path
DROP FUNCTION IF EXISTS update_project_total_from_version() CASCADE;

CREATE OR REPLACE FUNCTION public.update_project_total_from_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.projects
    SET total = NEW.total
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_project_total_trigger ON project_versions;
CREATE TRIGGER update_project_total_trigger
  AFTER INSERT OR UPDATE ON project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_total_from_version();

-- Drop and recreate update_updated_at_column function with fixed search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers for all tables that use this function
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_areas_updated_at ON project_areas;
CREATE TRIGGER update_project_areas_updated_at
  BEFORE UPDATE ON project_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_area_cabinets_updated_at ON area_cabinets;
CREATE TRIGGER update_area_cabinets_updated_at
  BEFORE UPDATE ON area_cabinets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_price_list_updated_at ON price_list;
CREATE TRIGGER update_price_list_updated_at
  BEFORE UPDATE ON price_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_catalog_updated_at ON products_catalog;
CREATE TRIGGER update_products_catalog_updated_at
  BEFORE UPDATE ON products_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_area_items_updated_at ON area_items;
CREATE TRIGGER update_area_items_updated_at
  BEFORE UPDATE ON area_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_versions_updated_at ON project_versions;
CREATE TRIGGER update_project_versions_updated_at
  BEFORE UPDATE ON project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_version_project_areas_updated_at ON version_project_areas;
CREATE TRIGGER update_version_project_areas_updated_at
  BEFORE UPDATE ON version_project_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_version_area_cabinets_updated_at ON version_area_cabinets;
CREATE TRIGGER update_version_area_cabinets_updated_at
  BEFORE UPDATE ON version_area_cabinets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_version_area_items_updated_at ON version_area_items;
CREATE TRIGGER update_version_area_items_updated_at
  BEFORE UPDATE ON version_area_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
