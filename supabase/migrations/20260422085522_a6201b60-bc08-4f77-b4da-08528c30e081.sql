ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_enabled boolean NOT NULL DEFAULT true;