-- 1. Add optional vendor_id column (NULL = platform-wide / admin coupon)
ALTER TABLE public.promo_coupons
  ADD COLUMN IF NOT EXISTS vendor_id uuid;

CREATE INDEX IF NOT EXISTS idx_promo_coupons_vendor_id
  ON public.promo_coupons (vendor_id);

-- 2. Allow providers to manage THEIR OWN coupons.
DROP POLICY IF EXISTS "Providers manage own coupons" ON public.promo_coupons;
CREATE POLICY "Providers manage own coupons"
ON public.promo_coupons
FOR ALL
TO authenticated
USING (
  vendor_id IS NOT NULL
  AND vendor_id = auth.uid()
  AND public.has_role(auth.uid(), 'provider')
)
WITH CHECK (
  vendor_id IS NOT NULL
  AND vendor_id = auth.uid()
  AND public.has_role(auth.uid(), 'provider')
);