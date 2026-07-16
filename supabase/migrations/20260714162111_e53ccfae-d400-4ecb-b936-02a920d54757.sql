
DROP POLICY IF EXISTS "Anyone can read demo-gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read demo-gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload demo-gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update demo-gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete demo-gallery files" ON storage.objects;

DROP TABLE IF EXISTS public.demo_gallery_items CASCADE;
DROP TYPE IF EXISTS public.demo_role;
DROP TYPE IF EXISTS public.demo_media_type;
