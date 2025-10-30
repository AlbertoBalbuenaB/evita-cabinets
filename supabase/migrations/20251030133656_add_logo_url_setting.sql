/*
  # Add Logo URL Setting

  ## Overview
  Adds a setting to store the company logo URL from Supabase Storage.
  This makes the logo URL configurable and allows users to update it easily.

  ## Changes
  1. Adds logo_url column to settings table
  2. Sets default value to use evita_logo.png from storage

  ## Usage
  The logo URL will be constructed as:
  {SUPABASE_URL}/storage/v1/object/public/logos/evita_logo.png
*/

-- Add logo_url column to settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE settings 
    ADD COLUMN logo_url text DEFAULT 'evita_logo.png';
  END IF;
END $$;

-- Update existing settings record to have the default logo path
UPDATE settings 
SET logo_url = 'evita_logo.png'
WHERE logo_url IS NULL OR logo_url = '';
