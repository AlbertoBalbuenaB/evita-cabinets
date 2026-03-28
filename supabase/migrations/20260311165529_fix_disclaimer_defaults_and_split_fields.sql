/*
  # Fix PDF Disclaimer Default Values - Split into Two Separate Fields

  ## Summary
  Updates the default values for disclaimer columns to match the new split design:
  - Tariff Information Disclaimer: Only the "Grand Total includes..." line
  - Price Validity & Conditions Disclaimer: Only the two asterisk lines

  ## Changes
  1. `disclaimer_tariff_info` - New default: "Grand Total includes design services, delivery costs, installation and tax."
  2. `disclaimer_price_validity` - New default: The two asterisk lines only

  ## Data Updates
  - Rows that had the old combined text in `disclaimer_price_validity` are split correctly
  - Rows that had the old combined text are updated to the new separate values
*/

ALTER TABLE projects
  ALTER COLUMN disclaimer_tariff_info SET DEFAULT 'Grand Total includes design services, delivery costs, installation and tax.';

ALTER TABLE projects
  ALTER COLUMN disclaimer_price_validity SET DEFAULT '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.';

UPDATE projects
SET
  disclaimer_tariff_info = 'Grand Total includes design services, delivery costs, installation and tax.',
  disclaimer_price_validity = '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.'
WHERE disclaimer_price_validity = 'Grand Total includes design services, delivery costs, installation and tax.

*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.';
