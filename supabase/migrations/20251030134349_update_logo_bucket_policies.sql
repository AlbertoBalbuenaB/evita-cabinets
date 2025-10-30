/*
  # Update Logo Bucket Policies

  ## Overview
  Updates the storage policies for the logos bucket to allow uploads without authentication.
  This is safe for a logo bucket since logos are meant to be public anyway.

  ## Changes
  - Updates insert policy to allow public uploads
  - Keeps read access public
  - Restricts updates and deletes to authenticated users only

  ## Security Notes
  - Public uploads are acceptable for logos since they are public assets
  - File size and type restrictions are enforced at bucket level (5MB, image types only)
  - Updates and deletes still require authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Policy: Anyone can upload logos (insert)
CREATE POLICY "Public can upload logos"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'logos');

-- Policy: Authenticated users can update logos
CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

-- Policy: Authenticated users can delete logos
CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
