CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  payment_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Vendors can request withdrawals
CREATE POLICY "Vendors can create withdrawal requests"
ON public.withdrawals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Vendors can view own withdrawals
CREATE POLICY "Vendors can view own withdrawals"
ON public.withdrawals FOR SELECT TO authenticated
USING (auth.uid() = vendor_id);

-- Moderators can view all withdrawals
CREATE POLICY "Moderators can view all withdrawals"
ON public.withdrawals FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Moderators can update withdrawals (approve/reject)
CREATE POLICY "Moderators can update withdrawals"
ON public.withdrawals FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Admins full access
CREATE POLICY "Admins can manage withdrawals"
ON public.withdrawals FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();