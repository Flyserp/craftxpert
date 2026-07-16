ALTER TABLE public.vendor_portfolio
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','pdf')),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;