/*
  # Add price_last_updated_at to price_list

  ## Summary
  Adds a dedicated timestamp column that tracks only when the `price` field was last
  changed, separate from `updated_at` which is touched on any field update.

  ## Changes

  ### Modified Tables
  - `price_list`
    - New column: `price_last_updated_at` (timestamptz, not null, defaults to now())
      Tracks the exact moment the price was last changed.

  ## Logic
  1. The column is initialized to `created_at` for all existing rows so every item
     has a meaningful value from day one.
  2. The existing `log_price_change` trigger function is extended to also stamp
     `price_last_updated_at = now()` on the `price_list` row whenever the price
     actually changes (i.e. OLD.price IS DISTINCT FROM NEW.price).

  ## Important Notes
  - On INSERT the column defaults to `now()` automatically — no trigger change needed.
  - The trigger already guards against spurious updates with the DISTINCT check.
  - Percentage change formula used in UI: ((new_price - old_price) / old_price) * 100
    Guard against division by zero when old_price = 0.
*/

-- 1. Add the column (defaults to now() for new inserts)
ALTER TABLE price_list
  ADD COLUMN IF NOT EXISTS price_last_updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Back-fill existing rows: use created_at as the baseline value
UPDATE price_list
SET price_last_updated_at = created_at
WHERE price_last_updated_at = now(); -- only rows just set by the ALTER default

-- 3. Extend the price-change trigger to also stamp the new column
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    -- Log the change
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

    -- Stamp the price-specific timestamp on the parent row
    NEW.price_last_updated_at := now();

    -- Mark affected projects as having stale prices
    WITH affected_projects AS (
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

      SELECT DISTINCT pa.project_id
      FROM area_items ai
      JOIN project_areas pa ON ai.area_id = pa.id
      WHERE ai.price_list_item_id = NEW.id

      UNION

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

-- Re-create the trigger as BEFORE UPDATE so NEW can be mutated
DROP TRIGGER IF EXISTS trigger_log_price_change ON price_list;
CREATE TRIGGER trigger_log_price_change
  BEFORE UPDATE ON price_list
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();
