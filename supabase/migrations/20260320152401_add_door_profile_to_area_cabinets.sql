/*
  # Add Door Profile columns to area_cabinets

  ## Summary
  Adds door profile support to the area_cabinets table. Door profiles (e.g., Shaker)
  run along the same perimeter as the doors edgeband, so cost is calculated identically:
  doors_fronts_edgeband meters × quantity × door profile price per meter.

  ## New Columns
  - `door_profile_id` (text, nullable): References a price_list item with type='Door Profile'.
    Stored as text with no FK constraint, following the same pattern as box_material_id, etc.
  - `door_profile_cost` (numeric, default 0): Calculated cost for the door profile.

  ## Notes
  - Both columns are optional; NULL door_profile_id means no profile selected, cost = 0.
  - No changes to price_list table needed — users create Door Profile items manually.
*/

ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS door_profile_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS door_profile_cost numeric(10,2) NOT NULL DEFAULT 0;
