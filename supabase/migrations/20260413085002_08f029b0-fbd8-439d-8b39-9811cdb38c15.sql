
-- Wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create wallets" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'top_up',
  amount NUMERIC NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert wallet transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions(wallet_id, created_at DESC);

-- Payment transactions
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  user_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  payment_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  paypal_order_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = vendor_id);
CREATE POLICY "Users can create payment transactions" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment transactions" ON public.payment_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Moderators can view all payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX idx_payment_transactions_booking ON public.payment_transactions(booking_id);
CREATE INDEX idx_payment_transactions_user ON public.payment_transactions(user_id, created_at DESC);

-- Refund requests
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  customer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id AND has_role(auth.uid(), 'customer'::app_role));
CREATE POLICY "Customers can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Moderators can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Moderators can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'moderator'::app_role));

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id),
  customer_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Vendors can view own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = vendor_id);
CREATE POLICY "Moderators can view all invoices" ON public.invoices FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "System can create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "System can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = customer_id OR has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX idx_invoices_customer ON public.invoices(customer_id, created_at DESC);
CREATE INDEX idx_invoices_vendor ON public.invoices(vendor_id, created_at DESC);

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.invoice_number := 'INV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || SUBSTR(NEW.id::text, 1, 8);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- Auto-create wallet for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_wallet_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_wallet();

-- Updated_at triggers
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for payment transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
