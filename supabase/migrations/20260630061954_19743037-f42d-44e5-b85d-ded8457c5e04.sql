ALTER TABLE public.admin_audit_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_log;