
-- 1. Tier column
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('individual','small_business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier public.subscription_tier NOT NULL DEFAULT 'individual';

-- 2. Deactivate legacy plans (keep rows so existing FKs from provider_subscriptions remain valid)
UPDATE public.subscription_plans SET is_active = false;

-- 3. Seed the 6 new plans
INSERT INTO public.subscription_plans (name, tier, interval, price, currency, features, is_active, sort_order) VALUES
  ('Individual Monthly',    'individual',     'monthly',    10,   'USD',
     '["Unlimited listings","Standard support","Verified badge eligibility"]'::jsonb, true, 10),
  ('Individual Quarterly',  'individual',     'quarterly',  30,   'USD',
     '["Unlimited listings","Standard support","Verified badge eligibility","Save vs monthly"]'::jsonb, true, 20),
  ('Individual Yearly',     'individual',     'yearly',     100,  'USD',
     '["Unlimited listings","Standard support","Verified badge eligibility","Best individual value"]'::jsonb, true, 30),
  ('Small Business Monthly','small_business', 'monthly',    100,  'USD',
     '["Everything in Individual","Team seats","Priority support","Featured placement"]'::jsonb, true, 110),
  ('Small Business Quarterly','small_business','quarterly', 300,  'USD',
     '["Everything in Individual","Team seats","Priority support","Featured placement","Save vs monthly"]'::jsonb, true, 120),
  ('Small Business Yearly', 'small_business', 'yearly',     1000, 'USD',
     '["Everything in Individual","Team seats","Priority support","Featured placement","Best business value"]'::jsonb, true, 130);

-- 4. Trigger: when a subscription payment is marked completed, activate the linked subscription
CREATE OR REPLACE FUNCTION public.activate_subscription_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_plan public.subscription_plans%ROWTYPE;
  v_now timestamptz := now();
  v_end timestamptz;
BEGIN
  IF NEW.payment_type <> 'subscription' THEN RETURN NEW; END IF;
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') = 'completed' THEN RETURN NEW; END IF;

  v_sub_id := NULLIF(NEW.metadata ->> 'subscription_id','')::uuid;
  IF v_sub_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.* INTO v_plan
    FROM public.provider_subscriptions ps
    JOIN public.subscription_plans p ON p.id = ps.plan_id
   WHERE ps.id = v_sub_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_end := CASE v_plan.interval::text
    WHEN 'monthly'   THEN v_now + interval '1 month'
    WHEN 'quarterly' THEN v_now + interval '3 months'
    WHEN 'yearly'    THEN v_now + interval '1 year'
    ELSE v_now + interval '1 month'
  END;

  -- Cancel any other active/pending subs for this provider (upgrade / downgrade / renew)
  UPDATE public.provider_subscriptions
     SET status = 'cancelled', cancel_at_period_end = true, updated_at = now()
   WHERE provider_id = NEW.user_id
     AND id <> v_sub_id
     AND status IN ('active','pending');

  UPDATE public.provider_subscriptions
     SET status = 'active',
         started_at = COALESCE(started_at, v_now),
         current_period_end = v_end,
         last_renewed_at = v_now,
         cancel_at_period_end = false,
         updated_at = now()
   WHERE id = v_sub_id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (NEW.user_id, 'Subscription active',
          'Your ' || v_plan.name || ' plan is now active until ' || to_char(v_end,'YYYY-MM-DD') || '.',
          'success',
          jsonb_build_object('event','subscription.activated','subscription_id',v_sub_id));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activate_subscription_on_payment ON public.payment_transactions;
CREATE TRIGGER trg_activate_subscription_on_payment
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.activate_subscription_on_payment();
