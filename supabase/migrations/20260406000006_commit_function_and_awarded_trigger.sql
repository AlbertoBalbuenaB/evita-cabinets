/*
  # Project inventory commit on Awarded status

  Adds inventory_auto_committed flag to projects.
  When a project transitions to 'Awarded', all linked purchase items that
  have not yet been committed are recorded as OUT inventory movements and
  flagged as committed.
*/

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS inventory_auto_committed BOOLEAN DEFAULT false NOT NULL;

-- =====================================================
-- Function: commit all uncommitted purchase items for a project
-- =====================================================
CREATE OR REPLACE FUNCTION commit_project_inventory(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item project_purchase_items%ROWTYPE;
BEGIN
  FOR item IN
    SELECT *
    FROM project_purchase_items
    WHERE project_id = p_project_id
      AND price_list_item_id IS NOT NULL
      AND inventory_committed = false
  LOOP
    INSERT INTO inventory_movements
      (price_list_item_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes)
    VALUES
      (item.price_list_item_id, 'OUT', item.quantity, 'PROJECT', item.id,
       item.price, 'Auto: project Awarded — inventory committed');

    UPDATE project_purchase_items
    SET inventory_committed = true
    WHERE id = item.id;
  END LOOP;

  UPDATE projects
  SET inventory_auto_committed = true
  WHERE id = p_project_id;
END;
$$;

-- =====================================================
-- Trigger function: fires when project status → 'Awarded'
-- =====================================================
CREATE OR REPLACE FUNCTION on_project_status_awarded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'Awarded'
     AND OLD.status != 'Awarded'
     AND NEW.inventory_auto_committed = false
  THEN
    PERFORM commit_project_inventory(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_status_awarded ON projects;
CREATE TRIGGER on_project_status_awarded
  AFTER UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_status_awarded();
