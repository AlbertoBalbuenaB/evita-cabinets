/*
  # Create inventory_movements table

  Ledger of every stock movement (IN / OUT / ADJUSTMENT / RETURN).
  A BEFORE INSERT trigger updates price_list.stock_quantity and
  maintains the weighted average cost (WAC) on every IN movement.
*/

CREATE TABLE IF NOT EXISTS inventory_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id    UUID NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
  movement_type         TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN')),
  quantity              DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  reference_type        TEXT CHECK (reference_type IN ('PURCHASE', 'PROJECT', 'MANUAL_ADJUSTMENT', 'RETURN')),
  reference_id          UUID,
  unit_cost             DECIMAL(12,4),
  running_average_cost  DECIMAL(12,4),
  notes                 TEXT,
  created_by_member_id  UUID REFERENCES team_members(id),
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on inventory_movements"
  ON inventory_movements FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- WAC trigger: update stock + average cost on insert
-- =====================================================
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec         price_list%ROWTYPE;
  new_qty     DECIMAL(12,3);
  new_avg     DECIMAL(12,4);
BEGIN
  SELECT * INTO rec
  FROM price_list
  WHERE id = NEW.price_list_item_id;

  IF NEW.movement_type = 'IN' THEN
    new_qty := rec.stock_quantity + NEW.quantity;
    new_avg := (rec.stock_quantity * COALESCE(rec.average_cost, 0)
                + NEW.quantity * COALESCE(NEW.unit_cost, 0))
               / NULLIF(new_qty, 0);

    UPDATE price_list
    SET
      stock_quantity     = new_qty,
      average_cost       = COALESCE(new_avg, 0),
      last_purchase_cost = COALESCE(NEW.unit_cost, rec.last_purchase_cost)
    WHERE id = NEW.price_list_item_id;

    NEW.running_average_cost := new_avg;

  ELSIF NEW.movement_type IN ('OUT', 'RETURN') THEN
    UPDATE price_list
    SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
    WHERE id = NEW.price_list_item_id;

    NEW.running_average_cost := rec.average_cost;

  ELSIF NEW.movement_type = 'ADJUSTMENT' THEN
    -- quantity is the new absolute stock level
    UPDATE price_list
    SET stock_quantity = NEW.quantity
    WHERE id = NEW.price_list_item_id;

    NEW.running_average_cost := rec.average_cost;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_stock_on_movement ON inventory_movements;
CREATE TRIGGER update_stock_on_movement
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_movement();
