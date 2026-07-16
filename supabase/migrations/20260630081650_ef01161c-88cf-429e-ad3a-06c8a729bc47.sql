
DROP POLICY IF EXISTS "Authenticated can read demo-gallery files" ON storage.objects;

CREATE POLICY "Anyone can read demo-gallery files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'demo-gallery');
