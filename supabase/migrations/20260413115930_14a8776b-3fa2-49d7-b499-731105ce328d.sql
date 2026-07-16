
-- Vendor lead credit balances
CREATE TABLE public.vendor_lead_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_lead_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own credits" ON public.vendor_lead_credits FOR SELECT USING (auth.uid() = vendor_id);
CREATE POLICY "Vendors can update own credits" ON public.vendor_lead_credits FOR UPDATE USING (auth.uid() = vendor_id);
CREATE POLICY "Vendors can insert own credits" ON public.vendor_lead_credits FOR INSERT WITH CHECK (auth.uid() = vendor_id);
CREATE POLICY "Admins can manage all credits" ON public.vendor_lead_credits FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_vendor_lead_credits_updated_at
  BEFORE UPDATE ON public.vendor_lead_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Purchase history
CREATE TABLE public.lead_credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL,
  bundle_label TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own purchases" ON public.lead_credit_purchases FOR SELECT USING (auth.uid() = vendor_id);
CREATE POLICY "Vendors can create purchases" ON public.lead_credit_purchases FOR INSERT WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));
CREATE POLICY "Admins can view all purchases" ON public.lead_credit_purchases FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
