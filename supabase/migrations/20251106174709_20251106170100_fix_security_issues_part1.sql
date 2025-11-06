/*
  # Fix Security Issues - Part 1

  ## Overview
  This migration addresses security and performance issues:
  1. Adds missing foreign key index
  2. Removes unused indexes

  ## Changes

  ### 1. Add Missing Index
  - Add index on project_version_details.area_id (foreign key without covering index)

  ### 2. Remove Unused Indexes
  - Drop multiple unused indexes to improve write performance
*/

-- Add missing foreign key index
CREATE INDEX IF NOT EXISTS idx_project_version_details_area_id
  ON project_version_details(area_id);

-- Remove unused indexes from area_cabinets
DROP INDEX IF EXISTS idx_area_cabinets_box_edgeband;
DROP INDEX IF EXISTS idx_area_cabinets_box_interior_finish;
DROP INDEX IF EXISTS idx_area_cabinets_doors_edgeband;
DROP INDEX IF EXISTS idx_area_cabinets_doors_interior_finish;
DROP INDEX IF EXISTS idx_area_cabinets_box_material_area;
DROP INDEX IF EXISTS idx_area_cabinets_box_edgeband_area;
DROP INDEX IF EXISTS idx_area_cabinets_doors_edgeband_area;
DROP INDEX IF EXISTS idx_area_cabinets_hardware_gin;

-- Remove unused indexes from area_items
DROP INDEX IF EXISTS idx_area_items_price_list_item;

-- Remove unused indexes from project_versions
DROP INDEX IF EXISTS idx_project_versions_type;

-- Remove unused indexes from cabinet_templates
DROP INDEX IF EXISTS idx_templates_category;
DROP INDEX IF EXISTS idx_templates_usage_count;
DROP INDEX IF EXISTS idx_templates_last_used;
DROP INDEX IF EXISTS idx_templates_product_sku;
DROP INDEX IF EXISTS idx_templates_created;
DROP INDEX IF EXISTS idx_templates_search;
DROP INDEX IF EXISTS idx_templates_category_usage;
DROP INDEX IF EXISTS idx_cabinet_templates_box_material;
DROP INDEX IF EXISTS idx_cabinet_templates_box_edgeband;
DROP INDEX IF EXISTS idx_cabinet_templates_box_interior_finish;
DROP INDEX IF EXISTS idx_cabinet_templates_doors_material;
DROP INDEX IF EXISTS idx_cabinet_templates_doors_edgeband;
DROP INDEX IF EXISTS idx_cabinet_templates_doors_interior_finish;

-- Remove unused indexes from template_usage_log
DROP INDEX IF EXISTS idx_usage_log_template;
DROP INDEX IF EXISTS idx_usage_log_used_at;
