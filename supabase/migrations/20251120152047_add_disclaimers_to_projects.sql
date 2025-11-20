/*
  # Add Custom Disclaimers to Projects

  1. Changes
    - Add `disclaimer_tariff_info` column to `projects` table
      - Stores the tariff information disclaimer text
      - Optional field with default value
    - Add `disclaimer_price_validity` column to `projects` table
      - Stores the price validity and conditions disclaimer text
      - Optional field with default value

  2. Security
    - No changes to RLS policies needed (inherits from projects table)
    - Users can only edit disclaimers for their own projects

  3. Notes
    - Default values match current hardcoded disclaimers
    - Backwards compatible - existing projects get default disclaimers
    - NULL values will use defaults in application layer
*/

-- Add disclaimer fields to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS disclaimer_tariff_info text DEFAULT 'Please note that the international tariff effective October 10 is 25%; however, only 11% of this tariff directly impacts the cost of this project.',
ADD COLUMN IF NOT EXISTS disclaimer_price_validity text DEFAULT 'Grand Total includes delivery cost and tax, but does not include unloading or installation services.

*Price is valid for 30 days and is subject to change due to international tariff rates.';

-- Add comment for documentation
COMMENT ON COLUMN projects.disclaimer_tariff_info IS 'Customizable tariff information disclaimer shown in USD Summary PDF';
COMMENT ON COLUMN projects.disclaimer_price_validity IS 'Customizable price validity and conditions disclaimer shown in USD Summary PDF';
