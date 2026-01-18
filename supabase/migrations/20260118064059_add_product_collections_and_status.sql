/*
  # Add Product Collections (Libraries) and Status System

  ## Overview
  This migration adds support for organizing products into custom collections/libraries
  and implementing a status-based archival system for safe product management.

  ## Changes

  1. New Columns Added to products_catalog
    - `collection_name` (TEXT, default: 'Standard Catalog')
      - Allows organizing products into custom libraries (e.g., "2026 Catalog", "Premium Line")
      - Users can create collections on-the-fly by typing new names
    - `status` (VARCHAR, default: 'active')
      - Values: 'active', 'archived'
      - Archived products are hidden from new project selections but preserved for historical data

  2. Indexes
    - Index on `collection_name` for fast filtering by collection
    - Index on `status` for efficient active/archived queries

  3. Product Usage Tracking Function
    - `check_product_usage(product_sku TEXT)` returns usage count
    - Used to determine if a product can be safely edited or needs versioning

  ## Security
    - No RLS policy changes needed
    - Status field used for application-level filtering
    - Historical project data remains intact

  ## Important Notes
    - Existing products automatically get 'Standard Catalog' collection and 'active' status
    - Archived products remain in database and historical references stay valid
    - Product versioning creates new records with new SKUs (e.g., "CAB-001-V2")
*/

-- Add collection_name column to products_catalog
ALTER TABLE products_catalog
ADD COLUMN IF NOT EXISTS collection_name TEXT DEFAULT 'Standard Catalog';

-- Add status column to products_catalog
ALTER TABLE products_catalog
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_collection_name ON products_catalog(collection_name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products_catalog(status);

-- Add comment for documentation
COMMENT ON COLUMN products_catalog.collection_name IS 'Organizational library/collection name for grouping products (e.g., "2026 Catalog", "Premium Line")';
COMMENT ON COLUMN products_catalog.status IS 'Product status: active (visible in new projects) or archived (hidden but preserved for historical data)';

-- Create function to check product usage across projects
CREATE OR REPLACE FUNCTION check_product_usage(product_sku_param TEXT)
RETURNS TABLE(
  usage_count BIGINT,
  project_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ac.id)::BIGINT as usage_count,
    ARRAY_AGG(DISTINCT p.name ORDER BY p.name) as project_names
  FROM area_cabinets ac
  JOIN project_areas pa ON pa.id = ac.area_id
  JOIN projects p ON p.id = pa.project_id
  WHERE ac.product_sku = product_sku_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for the function
COMMENT ON FUNCTION check_product_usage(TEXT) IS 'Returns usage count and list of project names using a specific product SKU. Used for safe editing workflow.';

-- Update existing products to have default values (safety measure)
UPDATE products_catalog
SET
  collection_name = COALESCE(collection_name, 'Standard Catalog'),
  status = COALESCE(status, 'active')
WHERE collection_name IS NULL OR status IS NULL;
