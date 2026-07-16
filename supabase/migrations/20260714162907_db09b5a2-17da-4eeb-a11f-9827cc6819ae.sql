
CREATE TABLE public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('push','email','sms','in_app')),
  event_type text,
  title text,
  body text,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error text,
  provider_response jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_delivery_logs_created_at
  ON public.notification_delivery_logs (created_at DESC);
CREATE INDEX idx_notification_delivery_logs_recipient
  ON public.notification_delivery_logs (recipient_user_id, created_at DESC);
CREATE INDEX idx_notification_delivery_logs_status
  ON public.notification_delivery_logs (status, created_at DESC);

GRANT SELECT ON public.notification_delivery_logs TO authenticated;
GRANT ALL ON public.notification_delivery_logs TO service_role;

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification delivery logs"
  ON public.notification_delivery_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
