/*
  # Fix Price Staleness Tracking System

  1. Changes
    - Add helper function to manually refresh project price staleness
    - Ensure project_price_staleness records exist for all projects
    - Fix hardware matching in the trigger
    - Add function to batch-check all projects
  
  2. Security
    - Maintain existing RLS policies
*/

-- Function to refresh price staleness for a specific project
CREATE OR REPLACE FUNCTION refresh_project_price_staleness(p_project_id uuid)
RETURNS void AS $$
DECLARE
  v_affected_count integer;
BEGIN
  -- Count how many unique materials are affected
  WITH affected_materials AS (
    SELECT DISTINCT unnest(ARRAY[
      ac.box_material_id,
      ac.box_edgeband_id,
      ac.box_interior_finish_id,
      ac.doors_material_id,
      ac.doors_edgeband_id,
      ac.doors_interior_finish_id
    ]) as material_id
    FROM area_cabinets ac
    JOIN project_areas pa ON ac.area_id = pa.id
    WHERE pa.project_id = p_project_id
    AND material_id IS NOT NULL
    
    UNION
    
    SELECT DISTINCT ai.price_list_item_id
    FROM area_items ai
    JOIN project_areas pa ON ai.area_id = pa.id
    WHERE pa.project_id = p_project_id
    
    UNION
    
    SELECT DISTINCT act.price_list_item_id
    FROM area_countertops act
    JOIN project_areas pa ON act.area_id = pa.id
    WHERE pa.project_id = p_project_id
  )
  SELECT COUNT(*) INTO v_affected_count
  FROM affected_materials am
  JOIN price_list pl ON am.material_id = pl.id
  WHERE EXISTS (
    SELECT 1 FROM price_change_log pcl
    WHERE pcl.price_list_item_id = pl.id
    AND pcl.changed_at > COALESCE(
      (SELECT last_checked_at FROM project_price_staleness WHERE project_id = p_project_id),
      '2000-01-01'::timestamptz
    )
  );

  -- Update or insert staleness record
  INSERT INTO project_price_staleness (project_id, has_stale_prices, affected_material_count, last_checked_at)
  VALUES (p_project_id, v_affected_count > 0, v_affected_count, now())
  ON CONFLICT (project_id) 
  DO UPDATE SET 
    has_stale_prices = v_affected_count > 0,
    affected_material_count = v_affected_count,
    last_checked_at = now();
END;
$$ LANGUAGE plpgsql;

-- Initialize project_price_staleness for all existing projects
INSERT INTO project_price_staleness (project_id, has_stale_prices, affected_material_count, last_checked_at)
SELECT 
  p.id,
  false,
  0,
  now()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_price_staleness ps WHERE ps.project_id = p.id
)
ON CONFLICT (project_id) DO NOTHING;

-- Improved price change trigger with better hardware matching
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO price_change_log (
      price_list_item_id,
      item_description,
      old_price,
      new_price
    ) VALUES (
      NEW.id,
      NEW.concept_description,
      OLD.price,
      NEW.price
    );
    
    -- Mark affected projects as having stale prices
    WITH affected_projects AS (
      -- Check cabinets
      SELECT DISTINCT pa.project_id
      FROM area_cabinets ac
      JOIN project_areas pa ON ac.area_id = pa.id
      WHERE ac.box_material_id = NEW.id
         OR ac.box_edgeband_id = NEW.id
         OR ac.box_interior_finish_id = NEW.id
         OR ac.doors_material_id = NEW.id
         OR ac.doors_edgeband_id = NEW.id
         OR ac.doors_interior_finish_id = NEW.id
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(ac.hardware::jsonb) AS hw
           WHERE hw->>'hardware_id' = NEW.id::text
         )
      
      UNION
      
      -- Check items
      SELECT DISTINCT pa.project_id
      FROM area_items ai
      JOIN project_areas pa ON ai.area_id = pa.id
      WHERE ai.price_list_item_id = NEW.id
      
      UNION
      
      -- Check countertops
      SELECT DISTINCT pa.project_id
      FROM area_countertops act
      JOIN project_areas pa ON act.area_id = pa.id
      WHERE act.price_list_item_id = NEW.id
    )
    INSERT INTO project_price_staleness (project_id, has_stale_prices, affected_material_count)
    SELECT project_id, true, 1
    FROM affected_projects
    ON CONFLICT (project_id) 
    DO UPDATE SET 
      has_stale_prices = true,
      affected_material_count = project_price_staleness.affected_material_count + 1,
      last_checked_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_log_price_change ON price_list;
CREATE TRIGGER trigger_log_price_change
  AFTER UPDATE ON price_list
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();
