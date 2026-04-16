-- Fix 460-series products: change cut_pieces material from 'custom' to 'frente'
-- 288 products had material='custom' which incorrectly routed to box_material_id
-- in the optimizer. Panels/accessories should use Doors & Fronts material.
-- Applied via MCP apply_migration on 2026-04-16

UPDATE products_catalog
SET cut_pieces = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'material' = 'custom'
    THEN jsonb_set(elem, '{material}', '"frente"')
    ELSE elem END
  ) FROM jsonb_array_elements(cut_pieces) elem
)
WHERE sku LIKE '460-%' AND cut_pieces IS NOT NULL
AND EXISTS (SELECT 1 FROM jsonb_array_elements(cut_pieces) e WHERE e->>'material' = 'custom');
