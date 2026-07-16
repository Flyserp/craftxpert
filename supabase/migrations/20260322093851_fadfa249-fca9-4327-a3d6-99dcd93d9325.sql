
-- Function to check tenant vendor limit
CREATE OR REPLACE FUNCTION public.check_tenant_vendor_limit(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'allowed', COALESCE(sp.max_vendors, 999),
    'current', (SELECT count(*)::int FROM tenant_members tm WHERE tm.tenant_id = _tenant_id AND tm.role = 'vendor'),
    'exceeded', (SELECT count(*)::int FROM tenant_members tm WHERE tm.tenant_id = _tenant_id AND tm.role = 'vendor') >= COALESCE(sp.max_vendors, 999)
  )
  FROM tenants t
  LEFT JOIN subscription_plans sp ON sp.id = t.plan_id
  WHERE t.id = _tenant_id;
$$;

-- Function to check tenant service limit
CREATE OR REPLACE FUNCTION public.check_tenant_service_limit(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'allowed', COALESCE(sp.max_services, 999),
    'current', (SELECT count(*)::int FROM vendor_services vs WHERE vs.tenant_id = _tenant_id AND vs.is_active = true),
    'exceeded', (SELECT count(*)::int FROM vendor_services vs WHERE vs.tenant_id = _tenant_id AND vs.is_active = true) >= COALESCE(sp.max_services, 999)
  )
  FROM tenants t
  LEFT JOIN subscription_plans sp ON sp.id = t.plan_id
  WHERE t.id = _tenant_id;
$$;

-- Function to check tenant monthly booking limit
CREATE OR REPLACE FUNCTION public.check_tenant_booking_limit(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'allowed', COALESCE(sp.max_bookings_per_month, 999),
    'current', (SELECT count(*)::int FROM bookings b WHERE b.tenant_id = _tenant_id AND b.created_at >= date_trunc('month', now())),
    'exceeded', (SELECT count(*)::int FROM bookings b WHERE b.tenant_id = _tenant_id AND b.created_at >= date_trunc('month', now())) >= COALESCE(sp.max_bookings_per_month, 999)
  )
  FROM tenants t
  LEFT JOIN subscription_plans sp ON sp.id = t.plan_id
  WHERE t.id = _tenant_id;
$$;
