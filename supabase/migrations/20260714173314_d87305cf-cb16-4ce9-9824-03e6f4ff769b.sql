
-- 1. Profile restriction columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restricted_until timestamptz,
  ADD COLUMN IF NOT EXISTS restriction_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_restricted_until
  ON public.profiles(restricted_until) WHERE restricted_until IS NOT NULL;

-- 2. Helper: check if an entity has an open (undecided) report
CREATE OR REPLACE FUNCTION public.has_open_report(_type text, _id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_reports
    WHERE entity_type = _type
      AND entity_id = _id
      AND status IN ('pending', 'info_requested')
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_open_report(text, uuid) TO anon, authenticated;

-- 3. Restrictive SELECT policies hiding reported content from non-owner/non-admin
DROP POLICY IF EXISTS "Hide reported reviews until decided" ON public.reviews;
CREATE POLICY "Hide reported reviews until decided"
  ON public.reviews AS RESTRICTIVE FOR SELECT
  USING (
    NOT public.has_open_report('review', id)
    OR customer_id = auth.uid()
    OR vendor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Hide reported services until decided" ON public.vendor_services;
CREATE POLICY "Hide reported services until decided"
  ON public.vendor_services AS RESTRICTIVE FOR SELECT
  USING (
    NOT public.has_open_report('service', id)
    OR vendor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Hide reported tasks until decided" ON public.tasks;
CREATE POLICY "Hide reported tasks until decided"
  ON public.tasks AS RESTRICTIVE FOR SELECT
  USING (
    NOT public.has_open_report('task', id)
    OR customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4. Core enforcement function
CREATE OR REPLACE FUNCTION public.enforce_provider_restriction(_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reject_count int;
  v_stale_disputes int;
  v_reason text := NULL;
  v_new_until timestamptz := now() + interval '14 days';
  v_current timestamptz;
BEGIN
  IF _vendor_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_reject_count
    FROM public.vendor_verifications
    WHERE vendor_id = _vendor_id
      AND status = 'rejected'
      AND COALESCE(reviewed_at, updated_at) > now() - interval '90 days';

  SELECT COUNT(*) INTO v_stale_disputes
    FROM public.disputes
    WHERE reported_user_id = _vendor_id
      AND status IN ('open', 'under_review', 'info_requested')
      AND created_at < now() - interval '7 days';

  IF v_reject_count >= 3 THEN
    v_reason := 'Repeated verification rejections (' || v_reject_count || ' in the last 90 days).';
  ELSIF v_stale_disputes > 0 THEN
    v_reason := v_stale_disputes || ' unresolved dispute(s) open for more than 7 days.';
  END IF;

  IF v_reason IS NULL THEN RETURN; END IF;

  SELECT restricted_until INTO v_current FROM public.profiles WHERE user_id = _vendor_id;

  -- No-op if already restricted at least as long for same reason
  IF v_current IS NOT NULL AND v_current >= v_new_until THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET restricted_until = GREATEST(COALESCE(restricted_until, now()), v_new_until),
         restriction_reason = v_reason,
         updated_at = now()
   WHERE user_id = _vendor_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (_vendor_id, 'account_restricted', 'Account temporarily restricted',
          v_reason || ' Your ability to apply to jobs and list new services is paused until '
            || to_char(v_new_until, 'Mon DD, YYYY') || '.',
          jsonb_build_object('restricted_until', v_new_until, 'reason', v_reason));

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (NULL, 'provider.restricted', 'profile', _vendor_id::text,
          jsonb_build_object(
            'reason', v_reason,
            'restricted_until', v_new_until,
            'reject_count_90d', v_reject_count,
            'stale_disputes', v_stale_disputes
          ));
END $$;

-- 5. Triggers
CREATE OR REPLACE FUNCTION public.trg_check_restriction_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.enforce_provider_restriction(NEW.vendor_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_restriction_on_verification ON public.vendor_verifications;
CREATE TRIGGER enforce_restriction_on_verification
  AFTER INSERT OR UPDATE OF status ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_restriction_verification();

CREATE OR REPLACE FUNCTION public.trg_check_restriction_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reported_user_id IS NOT NULL THEN
    PERFORM public.enforce_provider_restriction(NEW.reported_user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_restriction_on_dispute ON public.disputes;
CREATE TRIGGER enforce_restriction_on_dispute
  AFTER INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_restriction_dispute();

-- 6. Nightly sweep so time-based (7-day) dispute rule fires without an update
CREATE OR REPLACE FUNCTION public.sweep_provider_restrictions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_count int := 0;
BEGIN
  FOR v_id IN
    SELECT DISTINCT reported_user_id FROM public.disputes
    WHERE reported_user_id IS NOT NULL
      AND status IN ('open','under_review','info_requested')
      AND created_at < now() - interval '7 days'
  LOOP
    PERFORM public.enforce_provider_restriction(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('checked', v_count);
END $$;

REVOKE ALL ON FUNCTION public.sweep_provider_restrictions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_provider_restrictions() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'provider-restriction-sweep') THEN
    PERFORM cron.unschedule('provider-restriction-sweep');
  END IF;
  PERFORM cron.schedule('provider-restriction-sweep', '17 * * * *',
    $cron$ SELECT public.sweep_provider_restrictions(); $cron$);
END $$;
