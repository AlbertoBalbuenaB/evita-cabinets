/*
  # Add applies_tariff flag to project_areas

  ## Summary
  Adds a boolean column `applies_tariff` to the `project_areas` table so that
  tariff costs can be applied selectively — only to areas where the flag is
  explicitly enabled — rather than to the entire project's materials subtotal.

  ## Changes

  ### Modified Tables
  - `project_areas`
    - New column: `applies_tariff` (boolean, NOT NULL, DEFAULT false)
      Controls whether this area's materials subtotal is included in the
      project-level tariff calculation.

  ## Notes
  1. Default is `false` — all existing areas are NOT tariff-applicable after
     migration. Projects that previously had a tariff_multiplier set will show
     $0 tariff until the user re-enables the flag on the relevant areas.
  2. No data loss — this is an additive change only.
*/

ALTER TABLE project_areas
ADD COLUMN IF NOT EXISTS applies_tariff boolean NOT NULL DEFAULT false;
