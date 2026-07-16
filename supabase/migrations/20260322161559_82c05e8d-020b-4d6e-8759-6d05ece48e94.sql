
-- Platform settings table for super admin to store Stripe keys and other config
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage platform settings
CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add payment columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN payment_intent_id text,
  ADD COLUMN payment_method text;

-- Add billing columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN billing_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN subscription_start date,
  ADD COLUMN subscription_end date;
