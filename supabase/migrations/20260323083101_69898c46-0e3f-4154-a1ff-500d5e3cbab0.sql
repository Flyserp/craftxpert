
-- Portfolio items table
CREATE TABLE public.vendor_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio is viewable by everyone"
ON public.vendor_portfolio FOR SELECT
TO public
USING (true);

CREATE POLICY "Vendors can insert own portfolio"
ON public.vendor_portfolio FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

CREATE POLICY "Vendors can update own portfolio"
ON public.vendor_portfolio FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

CREATE POLICY "Vendors can delete own portfolio"
ON public.vendor_portfolio FOR DELETE
TO authenticated
USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

-- Portfolio images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true);

-- Storage RLS policies
CREATE POLICY "Anyone can view portfolio images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio');

CREATE POLICY "Vendors can upload portfolio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Vendors can update own portfolio images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Vendors can delete own portfolio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
