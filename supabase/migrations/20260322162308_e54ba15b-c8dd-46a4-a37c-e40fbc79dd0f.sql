
-- Add commission settings to tenants table
ALTER TABLE public.tenants
  ADD COLUMN commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN commission_value numeric NOT NULL DEFAULT 10;

-- Add vendor status to tenant_members for approve/reject/suspend
ALTER TABLE public.tenant_members
  ADD COLUMN status text NOT NULL DEFAULT 'pending';
