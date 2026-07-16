
-- ============================================================
-- PHASE 1: Role consolidation + tenant removal (CASCADE strategy)
-- ============================================================

-- 1. Drop role/tenant functions WITH CASCADE — this removes every dependent policy automatically
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_tenant_vendor_limit(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_tenant_service_limit(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_tenant_booking_limit(uuid) CASCADE;

-- 2. Drop tenant tables
DROP TABLE IF EXISTS public.commission_audit_log CASCADE;
DROP TABLE IF EXISTS public.tenant_invitations CASCADE;
DROP TABLE IF EXISTS public.tenant_members CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TYPE IF EXISTS public.tenant_status;

-- 3. Drop tenant_id columns
ALTER TABLE public.bookings        DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.profiles        DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.vendor_services DROP COLUMN IF EXISTS tenant_id;

-- 4. Migrate user_roles via temporary text type
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;

UPDATE public.user_roles SET role = 'client'   WHERE role = 'customer';
UPDATE public.user_roles SET role = 'provider' WHERE role = 'vendor';
UPDATE public.user_roles SET role = 'admin'    WHERE role = 'moderator';

-- Replace the enum
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('client', 'provider', 'admin');

-- Dedupe in case the merge created (user, role) collisions
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.role = b.role;

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- 5. Recreate role helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id $$;

-- 6. Recreate handle_new_user (default = client; map legacy role names if present)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta_role text;
  resolved_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    CASE WHEN NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN true ELSE false END
  );

  meta_role := NEW.raw_user_meta_data ->> 'role';
  resolved_role := CASE meta_role
    WHEN 'client'    THEN 'client'::public.app_role
    WHEN 'provider'  THEN 'provider'::public.app_role
    WHEN 'admin'     THEN 'admin'::public.app_role
    WHEN 'customer'  THEN 'client'::public.app_role
    WHEN 'vendor'    THEN 'provider'::public.app_role
    WHEN 'moderator' THEN 'admin'::public.app_role
    ELSE 'client'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. Recreate ALL RLS policies with the new role names
-- ============================================================

-- bookings
CREATE POLICY "Clients can create bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Clients can view own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Clients can update own bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Providers can view their bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = vendor_id);
CREATE POLICY "Providers can update their bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cms_pages
CREATE POLICY "Admins can manage all cms pages" ON public.cms_pages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- disputes
CREATE POLICY "Admins can view all disputes" ON public.disputes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update disputes" ON public.disputes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete disputes" ON public.disputes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- invoices
CREATE POLICY "Admins can view all invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id OR public.has_role(auth.uid(), 'admin'));

-- lead_credit_purchases
CREATE POLICY "Admins can view all purchases" ON public.lead_credit_purchases
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Providers can create purchases" ON public.lead_credit_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- payment_transactions
CREATE POLICY "Admins can view all payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- platform_settings
CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- promo_coupons
CREATE POLICY "Admins can manage coupons" ON public.promo_coupons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- refund_requests
CREATE POLICY "Clients can create refund requests" ON public.refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Admins can view all refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update refund requests" ON public.refund_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- reviews
CREATE POLICY "Clients can create reviews for their bookings" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Providers can reply to their reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'))
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- service_categories
CREATE POLICY "Admins can manage categories" ON public.service_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- service_subcategories
CREATE POLICY "Admins can manage subcategories" ON public.service_subcategories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- task_proposals
CREATE POLICY "Clients can invite providers" ON public.task_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND public.has_role(auth.uid(), 'client')
    AND direction = 'customer_invited'
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_proposals.task_id AND t.customer_id = auth.uid() AND t.status = 'open')
  );
CREATE POLICY "Providers can apply to tasks" ON public.task_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = vendor_id
    AND public.has_role(auth.uid(), 'provider')
    AND direction = 'vendor_applied'
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_proposals.task_id AND t.customer_id = task_proposals.customer_id AND t.status = 'open')
  );
CREATE POLICY "Providers can update own proposals" ON public.task_proposals
  FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- tasks
CREATE POLICY "Clients can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Clients can update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));
CREATE POLICY "Admins can view all tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Providers can view open tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'provider') AND status = 'open');

-- user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- vendor_availability
CREATE POLICY "Providers can manage their own availability" ON public.vendor_availability
  FOR ALL USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- vendor_blocked_dates
CREATE POLICY "Providers can manage their own blocked dates" ON public.vendor_blocked_dates
  FOR ALL USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- vendor_lead_credits
CREATE POLICY "Admins can manage all credits" ON public.vendor_lead_credits
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- vendor_plans
CREATE POLICY "Admins can manage vendor plans" ON public.vendor_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- vendor_portfolio
CREATE POLICY "Providers can insert own portfolio" ON public.vendor_portfolio
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Providers can update own portfolio" ON public.vendor_portfolio
  FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Providers can delete own portfolio" ON public.vendor_portfolio
  FOR DELETE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- vendor_services
CREATE POLICY "Admins can view all vendor services" ON public.vendor_services
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Providers can insert their own services" ON public.vendor_services
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Providers can update their own services" ON public.vendor_services
  FOR UPDATE
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Providers can delete their own services" ON public.vendor_services
  FOR DELETE
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- vendor_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.vendor_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Providers can view own subscription" ON public.vendor_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = vendor_id);
CREATE POLICY "Providers can create own subscription" ON public.vendor_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "Providers can update own subscription" ON public.vendor_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));

-- withdrawals
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Providers can view own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = vendor_id);
CREATE POLICY "Providers can create withdrawal requests" ON public.withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'provider'));
