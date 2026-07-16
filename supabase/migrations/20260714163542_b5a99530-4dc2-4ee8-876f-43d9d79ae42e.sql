
-- Device token lifecycle management
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;

-- Deduplicate any existing rows sharing the same token (keep newest)
DELETE FROM public.device_tokens a
 USING public.device_tokens b
 WHERE a.token = b.token
   AND a.ctid < b.ctid;

-- Enforce token uniqueness for reliable upsert
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_unique ON public.device_tokens(token);

CREATE INDEX IF NOT EXISTS device_tokens_user_active_idx
  ON public.device_tokens(user_id) WHERE is_active = true;

-- Upsert helper for token registration (updates last_seen, re-activates, moves token to caller)
CREATE OR REPLACE FUNCTION public.register_device_token(
  _token text,
  _platform text,
  _app_version text DEFAULT NULL,
  _device_model text DEFAULT NULL,
  _locale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _token IS NULL OR length(btrim(_token)) = 0 THEN RAISE EXCEPTION 'Token required'; END IF;

  INSERT INTO public.device_tokens
    (user_id, token, platform, app_version, device_model, locale,
     last_seen_at, is_active, failure_count, last_error, disabled_at)
  VALUES
    (v_uid, _token, _platform, _app_version, _device_model, _locale,
     now(), true, 0, NULL, NULL)
  ON CONFLICT (token) DO UPDATE
    SET user_id       = EXCLUDED.user_id,
        platform      = EXCLUDED.platform,
        app_version   = COALESCE(EXCLUDED.app_version, public.device_tokens.app_version),
        device_model  = COALESCE(EXCLUDED.device_model, public.device_tokens.device_model),
        locale        = COALESCE(EXCLUDED.locale, public.device_tokens.locale),
        last_seen_at  = now(),
        is_active     = true,
        failure_count = 0,
        last_error    = NULL,
        disabled_at   = NULL,
        updated_at    = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.register_device_token(text, text, text, text, text) TO authenticated;

-- Mark a token invalid (called by send-push on FCM NotRegistered/InvalidRegistration/MismatchSenderId)
CREATE OR REPLACE FUNCTION public.invalidate_device_token(_token text, _reason text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.device_tokens
     SET is_active = false,
         disabled_at = now(),
         last_error = _reason,
         failure_count = failure_count + 1,
         updated_at = now()
   WHERE token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.invalidate_device_token(text, text) TO service_role;

-- Record a transient failure; auto-disable after too many strikes
CREATE OR REPLACE FUNCTION public.record_device_token_failure(_token text, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.device_tokens
     SET failure_count = failure_count + 1,
         last_error = _reason,
         is_active = CASE WHEN failure_count + 1 >= 5 THEN false ELSE is_active END,
         disabled_at = CASE WHEN failure_count + 1 >= 5 THEN now() ELSE disabled_at END,
         updated_at = now()
   WHERE token = _token;
END $$;

GRANT EXECUTE ON FUNCTION public.record_device_token_failure(text, text) TO service_role;

-- Housekeeping: prune tokens not seen in 90 days
CREATE OR REPLACE FUNCTION public.prune_stale_device_tokens(_older_than_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.device_tokens
   WHERE last_seen_at < now() - make_interval(days => _older_than_days);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.prune_stale_device_tokens(integer) TO service_role;
