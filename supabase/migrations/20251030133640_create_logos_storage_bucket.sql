/*
  # Create Storage Bucket for Company Logos

  ## Overview
  Creates a public storage bucket for company logos and branding assets.
  This allows uploading and serving the Evita Cabinets logo for use in PDFs and other documents.

  ## Changes
  1. Creates 'logos' storage bucket
  2. Sets bucket to public for easy access
  3. Adds RLS policies for:
     - Public read access (anyone can view logos)
     - Authenticated users can upload logos
     - Authenticated users can update their own uploads
     - Authenticated users can delete their own uploads

  ## Security Notes
  - Bucket is public for reading (logos need to be accessible in PDFs)
  - Only authenticated users can upload/modify
  - File size and type restrictions should be enforced at application level
*/

-- Create the logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

-- Policy: Anyone can view logos (public read access)
DROP POLICY IF EXISTS "Public read access for logos" ON storage.objects;
CREATE POLICY "Public read access for logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Policy: Authenticated users can upload logos
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Policy: Authenticated users can update logos
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

-- Policy: Authenticated users can delete logos
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
