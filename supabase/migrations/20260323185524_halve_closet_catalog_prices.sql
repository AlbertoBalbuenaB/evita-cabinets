/*
  # Halve All Closet Catalog Prices

  ## Summary
  Divides all prices in the closet_catalog table by 2.

  ## Changes
  - `price_with_backs_usd`: divided by 2 for all 1,222 rows
  - `price_without_backs_usd`: divided by 2 for all rows where this value is not null

  ## Notes
  - No existing projects reference these catalog prices directly (confirmed safe)
  - This is a one-time bulk correction to fix pricing that was entered at double the intended value
*/

UPDATE closet_catalog
SET
  price_with_backs_usd = price_with_backs_usd / 2,
  price_without_backs_usd = CASE
    WHEN price_without_backs_usd IS NOT NULL THEN price_without_backs_usd / 2
    ELSE NULL
  END,
  updated_at = now();
