/*
  # Update Price Validity & Conditions Disclaimer Default

  ## Summary
  Adds a third line to the default "Price Validity & Conditions Disclaimer":
  "*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets."

  ## Changes
  1. `disclaimer_price_validity` column default updated to include the new line
  2. Existing rows that still have the old 2-line default are updated to the new 3-line default
*/

ALTER TABLE projects
  ALTER COLUMN disclaimer_price_validity SET DEFAULT '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.';

UPDATE projects
SET disclaimer_price_validity = '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.'
WHERE disclaimer_price_validity = '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.';
