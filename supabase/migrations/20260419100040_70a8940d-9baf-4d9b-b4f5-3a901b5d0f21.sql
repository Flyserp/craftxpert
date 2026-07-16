-- Notification preferences per user, per event type
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own prefs" ON public.notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Soft-delete marker on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Allow users to insert their own audit entries (for self-service actions like account deletion)
CREATE POLICY "Users can log own self-service actions"
  ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() AND target_user_id = auth.uid());