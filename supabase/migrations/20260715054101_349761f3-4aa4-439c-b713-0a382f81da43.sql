ALTER TABLE public.category_commissions
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric NULL
  CHECK (deposit_percentage IS NULL OR (deposit_percentage >= 0 AND deposit_percentage <= 100));

INSERT INTO public.platform_settings (key, value, is_secret)
VALUES ('booking_deposit_percentage', '25', false)
ON CONFLICT (key) DO NOTHING;