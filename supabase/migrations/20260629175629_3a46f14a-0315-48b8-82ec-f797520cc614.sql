ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vacation_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacation_until date,
  ADD COLUMN IF NOT EXISTS show_availability_public boolean NOT NULL DEFAULT true;