
-- Promo coupons table
CREATE TABLE public.promo_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applicable_to TEXT NOT NULL DEFAULT 'booking',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active coupons viewable by authenticated users"
ON public.promo_coupons FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage coupons"
ON public.promo_coupons FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_promo_coupons_updated_at
BEFORE UPDATE ON public.promo_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default monetization settings into platform_settings
INSERT INTO public.platform_settings (key, value, is_secret) VALUES
  ('lead_credit_price', '1.00', false),
  ('lead_credit_bundle_5', '4.50', false),
  ('lead_credit_bundle_10', '8.00', false),
  ('lead_credit_bundle_25', '18.00', false),
  ('featured_listing_daily_fee', '5.00', false),
  ('featured_listing_weekly_fee', '25.00', false),
  ('featured_listing_monthly_fee', '75.00', false),
  ('platform_commission_rate', '10', false),
  ('platform_commission_type', 'percentage', false),
  ('tax_enabled', 'false', false),
  ('tax_rate', '0', false),
  ('tax_label', 'Tax', false),
  ('tax_included_in_price', 'false', false),
  ('payout_method', 'manual', false),
  ('payout_schedule', 'weekly', false),
  ('payout_minimum', '50', false),
  ('payout_currency', 'USD', false)
ON CONFLICT (key) DO NOTHING;
