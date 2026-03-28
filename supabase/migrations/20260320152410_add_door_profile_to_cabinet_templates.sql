/*
  # Add Door Profile columns to cabinet_templates

  ## Summary
  Adds door profile fields to the cabinet_templates table so that templates
  can carry a door profile selection forward when applied to new cabinets.

  ## New Columns
  - `door_profile_id` (text, nullable): ID of the selected door profile price list item.
  - `door_profile_name` (text, nullable): Resolved name of the door profile at template
    save time, for display purposes without requiring a join.

  ## Notes
  - Both fields follow the same pattern as doors_edgeband_id / doors_edgeband_name.
  - Optional — NULL means no door profile in the template.
*/

ALTER TABLE cabinet_templates
  ADD COLUMN IF NOT EXISTS door_profile_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS door_profile_name text DEFAULT NULL;
