/*
  # Create project_purchase_items table

  Tracks items purchased for a project. Status changes to 'In Warehouse'
  automatically create an inventory IN movement; 'Return' creates a RETURN
  movement. Both are handled by an AFTER UPDATE trigger.
*/

CREATE TABLE IF NOT EXISTS project_purchase_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  price_list_item_id      UUID REFERENCES price_list(id) ON DELETE SET NULL,
  concept                 TEXT NOT NULL,
  quantity                DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit                    TEXT,
  price                   DECIMAL(12,4) DEFAULT 0,
  subtotal                DECIMAL(12,4) GENERATED ALWAYS AS (quantity * price) STORED,
  priority                TEXT DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status                  TEXT DEFAULT 'Ordered'
                            CHECK (status IN ('Ordered', 'Paid', 'In Transit', 'In Warehouse', 'Return')),
  deadline                DATE,
  notes                   TEXT,
  supplier_id             UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  assigned_to_member_id   UUID REFERENCES team_members(id) ON DELETE SET NULL,
  inventory_committed     BOOLEAN DEFAULT false NOT NULL,
  display_order           INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_project_purchase_items_updated_at ON project_purchase_items;
CREATE TRIGGER update_project_purchase_items_updated_at
  BEFORE UPDATE ON project_purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE project_purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on project_purchase_items"
  ON project_purchase_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Auto inventory movement on status change
-- =====================================================
CREATE OR REPLACE FUNCTION auto_inventory_on_purchase_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only act when status actually changed and item is linked to price list
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.price_list_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'In Warehouse' AND OLD.status != 'In Warehouse' THEN
    INSERT INTO inventory_movements
      (price_list_item_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes)
    VALUES
      (NEW.price_list_item_id, 'IN', NEW.quantity, 'PURCHASE', NEW.id,
       NEW.price, 'Auto: purchase arrived in warehouse');

  ELSIF NEW.status = 'Return' AND OLD.status != 'Return' THEN
    INSERT INTO inventory_movements
      (price_list_item_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes)
    VALUES
      (NEW.price_list_item_id, 'RETURN', NEW.quantity, 'RETURN', NEW.id,
       NEW.price, 'Auto: purchase returned');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_inventory_on_purchase_status ON project_purchase_items;
CREATE TRIGGER auto_inventory_on_purchase_status
  AFTER UPDATE ON project_purchase_items
  FOR EACH ROW EXECUTE FUNCTION auto_inventory_on_purchase_status();
