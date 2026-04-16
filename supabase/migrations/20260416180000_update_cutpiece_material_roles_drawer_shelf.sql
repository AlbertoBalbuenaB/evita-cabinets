-- Update cut_pieces JSONB: change material role for drawer box and shelf pieces
-- Drawer Box Sides, Drawer Box Ends, Drawer Box Bottom: 'cuerpo' → 'drawer_box'
-- Shelves: 'cuerpo' → 'shelf'
-- Applied via MCP apply_migration on 2026-04-16

UPDATE products_catalog
SET cut_pieces = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'nombre' IN ('Drawer Box Sides', 'Drawer Box Ends', 'Drawer Box Bottom')
           AND elem->>'material' = 'cuerpo'
      THEN jsonb_set(elem, '{material}', '"drawer_box"')
      WHEN elem->>'nombre' = 'Shelves'
           AND elem->>'material' = 'cuerpo'
      THEN jsonb_set(elem, '{material}', '"shelf"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(cut_pieces) elem
)
WHERE cut_pieces IS NOT NULL
AND (
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(cut_pieces) e
    WHERE e->>'nombre' IN ('Drawer Box Sides', 'Drawer Box Ends', 'Drawer Box Bottom')
    AND e->>'material' = 'cuerpo'
  )
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(cut_pieces) e
    WHERE e->>'nombre' = 'Shelves'
    AND e->>'material' = 'cuerpo'
  )
);
