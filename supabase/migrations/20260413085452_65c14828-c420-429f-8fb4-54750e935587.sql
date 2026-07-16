
-- Add before/after photos and vendor reply columns
ALTER TABLE public.reviews
  ADD COLUMN before_photos TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN after_photos TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN vendor_reply TEXT,
  ADD COLUMN vendor_reply_at TIMESTAMP WITH TIME ZONE;

-- Allow vendors to reply to their reviews
CREATE POLICY "Vendors can reply to their reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role))
WITH CHECK (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Review photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true);

CREATE POLICY "Anyone can view review photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-photos');

CREATE POLICY "Authenticated users can upload review photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own review photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
