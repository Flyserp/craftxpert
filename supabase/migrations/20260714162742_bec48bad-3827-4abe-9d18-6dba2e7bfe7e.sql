
CREATE TABLE public.provider_push_settings (
  provider_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  booking_updates boolean NOT NULL DEFAULT true,
  new_messages boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  review_alerts boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_push_settings TO authenticated;
GRANT ALL ON public.provider_push_settings TO service_role;

ALTER TABLE public.provider_push_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers manage their own push settings"
  ON public.provider_push_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = provider_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = provider_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_provider_push_settings_updated_at
  BEFORE UPDATE ON public.provider_push_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
