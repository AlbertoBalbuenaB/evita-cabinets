/*
  # Update PDF Disclaimer Default Values

  ## Summary
  Updates the default values for the disclaimer columns in the `projects` table
  to use the current, correct disclaimer text instead of the outdated tariff/delivery text.

  ## Changes
  1. `disclaimer_tariff_info` - Set default to empty string (tariff info no longer needed)
  2. `disclaimer_price_validity` - Updated default to the correct multi-line disclaimer text:
     - "Grand Total includes design services, delivery costs, installation and tax."
     - "*Price is valid for 15 days and is subject to change due to international tariff rates."
     - "*Preliminary quote, based off of our best interpretation of the provided plans..."

  ## Data Updates
  - Existing rows that still have the old default tariff info text are cleared
  - Existing rows that still have the old default price validity text are updated to the new text

  ## Notes
  - Only rows with the exact old default value are updated (custom edits are preserved)
*/

ALTER TABLE projects
  ALTER COLUMN disclaimer_tariff_info SET DEFAULT '';

ALTER TABLE projects
  ALTER COLUMN disclaimer_price_validity SET DEFAULT 'Grand Total includes design services, delivery costs, installation and tax.

*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.';

UPDATE projects
SET disclaimer_tariff_info = ''
WHERE disclaimer_tariff_info = 'Please note that the international tariff effective October 10 is 25%; however, only 11% of this tariff directly impacts the cost of this project.';

UPDATE projects
SET disclaimer_price_validity = 'Grand Total includes design services, delivery costs, installation and tax.

*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.'
WHERE disclaimer_price_validity = 'Grand Total includes delivery cost and tax, but does not include unloading or installation services.

*Price is valid for 30 days and is subject to change due to international tariff rates.';
