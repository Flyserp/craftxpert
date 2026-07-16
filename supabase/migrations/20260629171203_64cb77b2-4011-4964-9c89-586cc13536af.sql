
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificates jsonb DEFAULT '[]'::jsonb;
