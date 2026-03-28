/*
  # Update Price Validity Disclaimer Default

  ## Summary
  Removes the tariff-specific language from the price validity disclaimer.

  ## Changes
  - Updates the DEFAULT value of `disclaimer_price_validity` on the `projects` table
    so new projects get the simplified first bullet: "*Price is valid for 15 days."
  - Backfills existing projects where the disclaimer still matches the old default
    (containing "subject to change due to international tariff rates") so they
    are updated to the new text. Projects with custom text are left untouched.

  ## New Default Text
  *Price is valid for 15 days.
  *Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
  *A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.
*/

ALTER TABLE projects
  ALTER COLUMN disclaimer_price_validity
  SET DEFAULT '*Price is valid for 15 days.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.';

UPDATE projects
SET disclaimer_price_validity = '*Price is valid for 15 days.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.'
WHERE disclaimer_price_validity = '*Price is valid for 15 days and is subject to change due to international tariff rates.
*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.
*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.';
