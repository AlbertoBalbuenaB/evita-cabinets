/*
  # Fix Function Search Path Security Issues

  ## Overview
  Fixes search_path mutability for all SECURITY DEFINER functions to prevent privilege escalation attacks.

  ## Security
  - All functions recreated with SET search_path = public, pg_temp
  - This prevents search_path injection attacks

  ## Functions Fixed
  - update_hardware_in_cabinet(jsonb, uuid, uuid)
  - remove_hardware_from_cabinet(jsonb, uuid)
  - calculate_hardware_cost(jsonb, integer)
  - count_cabinets_with_hardware(text, uuid, uuid[])
  - get_hardware_category(uuid)
  - check_project_price_staleness(uuid)
  - refresh_project_price_staleness(uuid)
  - get_next_version_number(uuid)
  - create_project_snapshot(uuid)
*/

-- Fix update_hardware_in_cabinet
DROP FUNCTION IF EXISTS update_hardware_in_cabinet(jsonb, uuid, uuid);
CREATE FUNCTION update_hardware_in_cabinet(
  p_hardware_array jsonb,
  p_old_hardware_id uuid,
  p_new_hardware_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_hardware_array)
  LOOP
    IF (v_item->>'id')::uuid = p_old_hardware_id THEN
      v_result := v_result || jsonb_build_array(
        jsonb_set(v_item, '{id}', to_jsonb(p_new_hardware_id))
      );
    ELSE
      v_result := v_result || jsonb_build_array(v_item);
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

-- Fix remove_hardware_from_cabinet
DROP FUNCTION IF EXISTS remove_hardware_from_cabinet(jsonb, uuid);
CREATE FUNCTION remove_hardware_from_cabinet(
  p_hardware_array jsonb,
  p_hardware_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_hardware_array)
  LOOP
    IF (v_item->>'id')::uuid != p_hardware_id THEN
      v_result := v_result || jsonb_build_array(v_item);
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

-- Fix calculate_hardware_cost
DROP FUNCTION IF EXISTS calculate_hardware_cost(jsonb, integer);
CREATE FUNCTION calculate_hardware_cost(
  p_hardware_array jsonb,
  p_cabinet_quantity integer
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric := 0;
  v_item jsonb;
  v_price numeric;
  v_quantity integer;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_hardware_array)
  LOOP
    SELECT unit_price INTO v_price
    FROM price_list
    WHERE id = (v_item->>'id')::uuid AND is_active = true
    LIMIT 1;
    
    v_quantity := (v_item->>'quantity')::integer;
    
    IF v_price IS NOT NULL THEN
      v_total := v_total + (v_price * v_quantity * p_cabinet_quantity);
    END IF;
  END LOOP;
  
  RETURN v_total;
END;
$$;

-- Fix count_cabinets_with_hardware
DROP FUNCTION IF EXISTS count_cabinets_with_hardware(text, uuid, uuid[]);
CREATE FUNCTION count_cabinets_with_hardware(
  p_table_name text,
  p_hardware_id uuid,
  p_area_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_query text;
BEGIN
  v_query := format(
    'SELECT COUNT(*)::integer FROM %I WHERE area_id = ANY($1) AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(hardware) hw WHERE (hw->>''id'')::uuid = $2
    )',
    p_table_name
  );
  
  EXECUTE v_query INTO v_count USING p_area_ids, p_hardware_id;
  RETURN v_count;
END;
$$;

-- Fix get_hardware_category
DROP FUNCTION IF EXISTS get_hardware_category(uuid);
CREATE FUNCTION get_hardware_category(p_hardware_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT category INTO v_category
  FROM price_list
  WHERE id = p_hardware_id AND is_active = true
  LIMIT 1;
  
  RETURN v_category;
END;
$$;

-- Fix check_project_price_staleness
DROP FUNCTION IF EXISTS check_project_price_staleness(uuid);
CREATE FUNCTION check_project_price_staleness(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_stale boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM price_change_log pcl
    WHERE pcl.project_id = p_project_id
    AND pcl.is_resolved = false
  ) INTO v_has_stale;
  
  RETURN COALESCE(v_has_stale, false);
END;
$$;

-- Fix refresh_project_price_staleness
DROP FUNCTION IF EXISTS refresh_project_price_staleness(uuid);
CREATE FUNCTION refresh_project_price_staleness(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO price_change_log (project_id, sku, old_price, new_price, change_date, is_resolved)
  SELECT DISTINCT
    pa.project_id,
    ac.box_material_sku,
    ac.original_box_material_price,
    pl.unit_price,
    NOW(),
    false
  FROM area_cabinets ac
  JOIN project_areas pa ON pa.id = ac.area_id
  JOIN price_list pl ON pl.sku = ac.box_material_sku AND pl.is_active = true
  WHERE pa.project_id = p_project_id
  AND ac.original_box_material_price IS NOT NULL
  AND ac.original_box_material_price != pl.unit_price
  ON CONFLICT (project_id, sku) WHERE is_resolved = false
  DO UPDATE SET
    new_price = EXCLUDED.new_price,
    change_date = EXCLUDED.change_date;
END;
$$;

-- Fix get_next_version_number
DROP FUNCTION IF EXISTS get_next_version_number(uuid);
CREATE FUNCTION get_next_version_number(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_num
  FROM project_versions
  WHERE project_id = p_project_id;

  RETURN next_num;
END;
$$;

-- Fix create_project_snapshot
DROP FUNCTION IF EXISTS create_project_snapshot(uuid);
CREATE FUNCTION create_project_snapshot(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  SELECT jsonb_build_object(
    'project', (SELECT to_jsonb(p) FROM projects p WHERE p.id = p_project_id),
    'areas', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'area', to_jsonb(pa),
          'cabinets', (
            SELECT jsonb_agg(to_jsonb(ac))
            FROM area_cabinets ac
            WHERE ac.area_id = pa.id
          ),
          'items', (
            SELECT jsonb_agg(to_jsonb(ai))
            FROM area_items ai
            WHERE ai.area_id = pa.id
          ),
          'countertops', (
            SELECT jsonb_agg(to_jsonb(act))
            FROM area_countertops act
            WHERE act.area_id = pa.id
          )
        )
      )
      FROM project_areas pa
      WHERE pa.project_id = p_project_id
    )
  ) INTO snapshot;

  RETURN snapshot;
END;
$$;

COMMENT ON FUNCTION update_hardware_in_cabinet IS 'Updates hardware item with fixed search_path for security';
COMMENT ON FUNCTION remove_hardware_from_cabinet IS 'Removes hardware from cabinet with fixed search_path for security';
COMMENT ON FUNCTION calculate_hardware_cost IS 'Calculates total hardware cost with fixed search_path for security';
COMMENT ON FUNCTION count_cabinets_with_hardware IS 'Counts cabinets with specific hardware with fixed search_path for security';
COMMENT ON FUNCTION get_hardware_category IS 'Gets hardware category with fixed search_path for security';
COMMENT ON FUNCTION check_project_price_staleness IS 'Checks if project has stale prices with fixed search_path for security';
COMMENT ON FUNCTION refresh_project_price_staleness IS 'Refreshes price staleness data with fixed search_path for security';
COMMENT ON FUNCTION get_next_version_number IS 'Gets next version number with fixed search_path for security';
COMMENT ON FUNCTION create_project_snapshot IS 'Creates project snapshot with fixed search_path for security';
