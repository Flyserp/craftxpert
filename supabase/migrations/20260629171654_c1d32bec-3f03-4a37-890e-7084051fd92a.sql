
-- Enums
DO $$ BEGIN
  CREATE TYPE public.subscription_interval AS ENUM ('monthly','quarterly','yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active','expired','cancelled','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Plans catalog
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  interval public.subscription_interval NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Provider subscriptions
CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_renewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_subs_provider ON public.provider_subscriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_subs_status ON public.provider_subscriptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_subscriptions TO authenticated;
GRANT ALL ON public.provider_subscriptions TO service_role;
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers view own subscription" ON public.provider_subscriptions
  FOR SELECT USING (auth.uid() = provider_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Providers create own subscription" ON public.provider_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Providers update own subscription" ON public.provider_subscriptions
  FOR UPDATE USING (auth.uid() = provider_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = provider_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete subscriptions" ON public.provider_subscriptions
  FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_provider_subs_updated
  BEFORE UPDATE ON public.provider_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is provider currently subscribed?
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_subscriptions
    WHERE provider_id = _user_id
      AND status = 'active'
      AND current_period_end > now()
  );
$$;

-- Seed default plans
INSERT INTO public.subscription_plans (name, interval, price, features, sort_order)
SELECT * FROM (VALUES
  ('Monthly',   'monthly'::public.subscription_interval,   19.00, '["Unlimited listings","Priority support","Featured badge"]'::jsonb, 1),
  ('Quarterly', 'quarterly'::public.subscription_interval, 49.00, '["Unlimited listings","Priority support","Featured badge","Save 14%"]'::jsonb, 2),
  ('Yearly',    'yearly'::public.subscription_interval,   179.00, '["Unlimited listings","Priority support","Featured badge","Save 21%","Early access to new tools"]'::jsonb, 3)
) AS v(name, interval, price, features, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);
