/*
  # Update Settings RLS Policies

  1. Changes
    - Drop existing policies
    - Add new policy for public read access (no authentication required)
    - Add new policy for public update access (no authentication required)
  
  2. Reason
    - Application doesn't have authentication yet
    - Settings need to be accessible without login
*/

DROP POLICY IF EXISTS "Users can read settings" ON settings;
DROP POLICY IF EXISTS "Users can update settings" ON settings;

CREATE POLICY "Anyone can read settings"
  ON settings
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update settings"
  ON settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
