
-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-logos', 'tenant-logos', true);

-- Allow authenticated users to upload to tenant-logos bucket
CREATE POLICY "Authenticated users can upload tenant logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-logos');

-- Allow anyone to view tenant logos (public bucket)
CREATE POLICY "Anyone can view tenant logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tenant-logos');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own tenant logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-logos');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own tenant logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-logos');
