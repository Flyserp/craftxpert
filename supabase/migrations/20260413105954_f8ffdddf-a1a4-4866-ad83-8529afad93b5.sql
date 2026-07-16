ALTER TABLE public.profiles ADD COLUMN profile_completed boolean NOT NULL DEFAULT false;

-- Mark all existing profiles as completed (they were created via email signup)
UPDATE public.profiles SET profile_completed = true;