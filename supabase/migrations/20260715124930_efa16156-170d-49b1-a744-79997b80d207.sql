CREATE TABLE public.verification_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_key text NOT NULL,
  window_days integer NOT NULL,
  window_label text,
  kind text NOT NULL CHECK (kind IN ('vendor','employer')),
  target_id text NOT NULL,
  recipient_user_id uuid,
  recipient_email text,
  recipient_name text,
  expires_at timestamptz,
  notification_id uuid,
  in_app_status text NOT NULL DEFAULT 'pending' CHECK (in_app_status IN ('pending','sent','failed','skipped')),
  in_app_error text,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed','skipped')),
  email_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_reminder_log_created_at_idx
  ON public.verification_reminder_log (created_at DESC);
CREATE INDEX verification_reminder_log_window_idx
  ON public.verification_reminder_log (window_key, created_at DESC);
CREATE INDEX verification_reminder_log_recipient_idx
  ON public.verification_reminder_log (recipient_user_id);
CREATE INDEX verification_reminder_log_target_idx
  ON public.verification_reminder_log (target_id);

GRANT SELECT ON public.verification_reminder_log TO authenticated;
GRANT ALL ON public.verification_reminder_log TO service_role;

ALTER TABLE public.verification_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view verification reminder logs"
  ON public.verification_reminder_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role manages verification reminder logs"
  ON public.verification_reminder_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_verification_reminder_log_updated_at
  BEFORE UPDATE ON public.verification_reminder_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();