
-- Vendor-specific subscription plans
CREATE TABLE public.vendor_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  max_leads_per_month INTEGER NOT NULL DEFAULT 10,
  ranking_boost INTEGER NOT NULL DEFAULT 0,
  has_analytics BOOLEAN NOT NULL DEFAULT false,
  has_featured_listing BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active vendor plans viewable by everyone"
ON public.vendor_plans FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage vendor plans"
ON public.vendor_plans FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Vendor subscriptions
CREATE TABLE public.vendor_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.vendor_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id)
);

ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own subscription"
ON public.vendor_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage all subscriptions"
ON public.vendor_subscriptions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendors can create own subscription"
ON public.vendor_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

CREATE POLICY "Vendors can update own subscription"
ON public.vendor_subscriptions FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Seed the 3 default plans
INSERT INTO public.vendor_plans (name, slug, price, max_leads_per_month, ranking_boost, has_analytics, has_featured_listing, has_priority_support, sort_order, features) VALUES
('Free', 'free', 0, 10, 0, false, false, false, 0, '["Up to 10 leads/month", "Basic profile", "Standard search ranking", "Community support"]'::jsonb),
('Pro', 'pro', 19, 50, 2, true, false, true, 1, '["Up to 50 leads/month", "Enhanced profile", "Higher search ranking", "Detailed analytics dashboard", "Priority email support", "Badge on profile"]'::jsonb),
('Elite', 'elite', 49, 999, 5, true, true, true, 2, '["Unlimited leads", "Premium profile", "Top search ranking", "Advanced analytics & insights", "Featured listing in category", "Priority phone & email support", "Verified Elite badge", "Early access to new features"]'::jsonb);

-- Trigger for updated_at
CREATE TRIGGER update_vendor_plans_updated_at
BEFORE UPDATE ON public.vendor_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_subscriptions_updated_at
BEFORE UPDATE ON public.vendor_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
