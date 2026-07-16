
CREATE TYPE public.demo_role AS ENUM ('provider','customer','employer','admin');
CREATE TYPE public.demo_media_type AS ENUM ('image','gif','video');

CREATE TABLE public.demo_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.demo_role NOT NULL,
  title text NOT NULL,
  description text,
  media_type public.demo_media_type NOT NULL,
  media_url text NOT NULL,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX demo_gallery_items_role_idx ON public.demo_gallery_items(role, sort_order);

GRANT SELECT ON public.demo_gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_gallery_items TO authenticated;
GRANT ALL ON public.demo_gallery_items TO service_role;

ALTER TABLE public.demo_gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published demo items"
ON public.demo_gallery_items FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage demo items"
ON public.demo_gallery_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_demo_gallery_items_updated_at
BEFORE UPDATE ON public.demo_gallery_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for demo-gallery bucket
CREATE POLICY "Authenticated can read demo-gallery files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'demo-gallery');

CREATE POLICY "Admins can upload demo-gallery files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'demo-gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update demo-gallery files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'demo-gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete demo-gallery files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'demo-gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));
