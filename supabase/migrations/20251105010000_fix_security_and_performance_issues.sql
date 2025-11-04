/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses security vulnerabilities and performance issues identified in the database:
  - Adds missing indexes on foreign key columns
  - Fixes mutable search paths on functions for security
  - Optimizes query performance

  ## Changes

  ### 1. Add Missing Indexes on Foreign Keys
  Adds indexes to foreign key columns that were missing covering indexes, which can cause
  suboptimal query performance when joining tables or enforcing referential integrity.

  ### 2. Fix Function Search Paths
  Updates all functions to use immutable search paths by explicitly setting the search_path,
  preventing potential security vulnerabilities from search path manipulation.

  ## Security Impact
  - Prevents search path manipulation attacks
  - Improves query performance on joins and lookups
  - Ensures consistent function behavior across schema changes
*/

-- ============================================================================
-- ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Indexes for area_items table
CREATE INDEX IF NOT EXISTS idx_area_items_price_list_item ON area_items(price_list_item_id);

-- Indexes for cabinet_templates table
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_box_material ON cabinet_templates(box_material_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_box_edgeband ON cabinet_templates(box_edgeband_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_box_interior_finish ON cabinet_templates(box_interior_finish_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_doors_material ON cabinet_templates(doors_material_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_doors_edgeband ON cabinet_templates(doors_edgeband_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_templates_doors_interior_finish ON cabinet_templates(doors_interior_finish_id);

-- Indexes for version_area_cabinets table
CREATE INDEX IF NOT EXISTS idx_version_area_cabinets_product ON version_area_cabinets(product_id);

-- Indexes for version_area_items table
CREATE INDEX IF NOT EXISTS idx_version_area_items_price_list_item ON version_area_items(price_list_item_id);

-- ============================================================================
-- FIX FUNCTION SEARCH PATHS FOR SECURITY
-- ============================================================================

-- Fix update_template_usage_stats function
CREATE OR REPLACE FUNCTION update_template_usage_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE cabinet_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = NEW.used_at,
    updated_at = NOW()
  WHERE id = NEW.template_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix update_template_timestamp function
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix get_most_used_templates function
CREATE OR REPLACE FUNCTION get_most_used_templates(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  category VARCHAR,
  usage_count INTEGER,
  last_used_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.category,
    ct.usage_count,
    ct.last_used_at
  FROM cabinet_templates ct
  WHERE ct.usage_count > 0
  ORDER BY ct.usage_count DESC, ct.last_used_at DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Fix get_template_usage_by_category function
CREATE OR REPLACE FUNCTION get_template_usage_by_category()
RETURNS TABLE (
  category VARCHAR,
  total_templates BIGINT,
  total_uses BIGINT
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.category,
    COUNT(DISTINCT ct.id) as total_templates,
    COALESCE(SUM(ct.usage_count), 0) as total_uses
  FROM cabinet_templates ct
  GROUP BY ct.category
  ORDER BY total_uses DESC;
END;
$$ LANGUAGE plpgsql;

-- Fix get_template_usage_timeline function
CREATE OR REPLACE FUNCTION get_template_usage_timeline(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  usage_date DATE,
  usage_count BIGINT
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(tul.used_at) as usage_date,
    COUNT(*) as usage_count
  FROM template_usage_log tul
  WHERE tul.used_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(tul.used_at)
  ORDER BY usage_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_area_items_price_list_item IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_box_material IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_box_edgeband IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_box_interior_finish IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_doors_material IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_doors_edgeband IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_cabinet_templates_doors_interior_finish IS 'Performance: Covers foreign key for joins with price_list';
COMMENT ON INDEX idx_version_area_cabinets_product IS 'Performance: Covers foreign key for joins with products_catalog';
COMMENT ON INDEX idx_version_area_items_price_list_item IS 'Performance: Covers foreign key for joins with price_list';
