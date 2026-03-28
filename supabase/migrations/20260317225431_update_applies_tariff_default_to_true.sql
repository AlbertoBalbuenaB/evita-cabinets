/*
  # Update applies_tariff default to true

  Changes the default value of `applies_tariff` on `project_areas` from false to true.
  Existing rows that were added with the previous default of false are also updated to true
  so that all existing areas are now tariff-applicable by default.

  This reflects the intended use case: most areas carry tariff, and occasionally one doesn't.
*/

ALTER TABLE project_areas
  ALTER COLUMN applies_tariff SET DEFAULT true;

UPDATE project_areas
  SET applies_tariff = true
  WHERE applies_tariff = false;
