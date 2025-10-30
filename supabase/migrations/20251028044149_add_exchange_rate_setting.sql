/*
  # Add Exchange Rate Setting

  1. New Setting
    - Add exchange_rate_usd_to_mxn setting with default value of 18.00
    - Category: currency
    - Description: USD to MXN exchange rate
  
  2. Notes
    - This setting is used to display project totals in Mexican Pesos
    - Default rate is $18.00 MXN per $1.00 USD
*/

INSERT INTO settings (key, value, category, description)
VALUES (
  'exchange_rate_usd_to_mxn',
  '18.00',
  'currency',
  'USD to MXN Exchange Rate'
)
ON CONFLICT (key) DO NOTHING;
