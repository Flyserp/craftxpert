
CREATE TABLE public.tenant_push_defaults (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  push_enabled boolean NOT NULL DEFAULT true,
  booking_updates boolean NOT NULL DEFAULT true,
  new_messages boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  review_alerts boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.tenant_push_defaults TO authenticated;
GRANT ALL ON public.tenant_push_defaults TO service_role;

ALTER TABLE public.tenant_push_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read tenant push defaults"
  ON public.tenant_push_defaults FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert tenant push defaults"
  ON public.tenant_push_defaults FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update tenant push defaults"
  ON public.tenant_push_defaults FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.tenant_push_defaults (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.provider_push_settings
  ADD COLUMN IF NOT EXISTS overrides_defaults boolean NOT NULL DEFAULT false;
