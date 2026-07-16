ALTER TABLE public.withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_lead_credits REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_lead_credits;