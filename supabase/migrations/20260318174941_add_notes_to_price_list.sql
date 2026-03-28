/*
  # Add notes column to price_list table

  ## Summary
  Adds an optional free-text `notes` column to the `price_list` table so users
  can attach observations or additional information to any price list item.

  ## Changes
  - **price_list** table
    - New column: `notes` (text, nullable) — stores user-entered notes or
      observations for the item. No default value; existing rows will have NULL.

  ## Notes
  - Non-destructive: existing data is unaffected.
  - No RLS changes required; the column falls under the existing policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_list' AND column_name = 'notes'
  ) THEN
    ALTER TABLE price_list ADD COLUMN notes text;
  END IF;
END $$;
