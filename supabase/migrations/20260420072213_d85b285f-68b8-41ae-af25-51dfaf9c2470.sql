-- 1. provider_settings (per-provider plan)
CREATE TABLE IF NOT EXISTS public.provider_settings (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'elite')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider reads own settings" ON public.provider_settings;
CREATE POLICY "Provider reads own settings"
ON public.provider_settings FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Provider upserts own settings" ON public.provider_settings;
CREATE POLICY "Provider upserts own settings"
ON public.provider_settings FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Provider updates own settings" ON public.provider_settings;
CREATE POLICY "Provider updates own settings"
ON public.provider_settings FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. provider_staff
CREATE TABLE IF NOT EXISTS public.provider_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  staff_user_id uuid NOT NULL,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, staff_user_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_staff_provider ON public.provider_staff (provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_staff_staff ON public.provider_staff (staff_user_id);

ALTER TABLE public.provider_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider manages own staff" ON public.provider_staff;
CREATE POLICY "Provider manages own staff"
ON public.provider_staff FOR ALL TO authenticated
USING (provider_id = auth.uid())
WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS "Staff sees own membership" ON public.provider_staff;
CREATE POLICY "Staff sees own membership"
ON public.provider_staff FOR SELECT TO authenticated
USING (staff_user_id = auth.uid());

-- 3. staff_invitations
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  title text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_provider ON public.staff_invitations (provider_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations (token);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider manages own invites" ON public.staff_invitations;
CREATE POLICY "Provider manages own invites"
ON public.staff_invitations FOR ALL TO authenticated
USING (provider_id = auth.uid())
WITH CHECK (provider_id = auth.uid());

-- Public token-based lookup is handled by SECURITY DEFINER function below
-- (no public SELECT policy on the raw table, to avoid leaking emails).

CREATE OR REPLACE FUNCTION public.get_staff_invitation(_token text)
RETURNS TABLE (
  id uuid,
  provider_id uuid,
  provider_name text,
  email text,
  title text,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id,
    si.provider_id,
    pr.display_name AS provider_name,
    si.email,
    si.title,
    si.status,
    si.expires_at
  FROM public.staff_invitations si
  LEFT JOIN public.profiles pr ON pr.user_id = si.provider_id
  WHERE si.token = _token
  LIMIT 1;
$$;

-- Function: accept an invitation (called by the staff user after login)
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.staff_invitations%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.staff_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found');
  END IF;
  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'Invitation is no longer pending');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.staff_invitations SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('error', 'Invitation has expired');
  END IF;

  INSERT INTO public.provider_staff (provider_id, staff_user_id, title)
  VALUES (v_invite.provider_id, v_user_id, v_invite.title)
  ON CONFLICT (provider_id, staff_user_id) DO NOTHING;

  UPDATE public.staff_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'provider_id', v_invite.provider_id);
END;
$$;

-- 4. bookings.assigned_staff_id
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid;
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_staff ON public.bookings (assigned_staff_id);

-- Allow assigned staff to read the bookings they're assigned to
DROP POLICY IF EXISTS "Assigned staff can read booking" ON public.bookings;
CREATE POLICY "Assigned staff can read booking"
ON public.bookings FOR SELECT TO authenticated
USING (assigned_staff_id = auth.uid());