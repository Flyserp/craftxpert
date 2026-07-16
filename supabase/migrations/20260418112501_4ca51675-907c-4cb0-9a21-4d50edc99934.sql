-- 1. Audit log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert audit entries"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Update approve_refund to log
CREATE OR REPLACE FUNCTION public.approve_refund(_refund_id uuid, _admin_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _refund refund_requests%ROWTYPE;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve refunds';
  END IF;

  SELECT * INTO _refund FROM refund_requests WHERE id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund request not found'; END IF;
  IF _refund.status = 'approved' THEN RAISE EXCEPTION 'Refund already approved'; END IF;

  INSERT INTO wallets (user_id) VALUES (_refund.customer_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallets SET balance = balance + _refund.amount, updated_at = now()
   WHERE user_id = _refund.customer_id
   RETURNING id, balance INTO _wallet_id, _new_balance;

  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference_id)
  VALUES (_wallet_id, _refund.customer_id, 'refund', _refund.amount,
          'Refund approved for booking ' || substr(_refund.booking_id::text, 1, 8), _refund.id::text);

  UPDATE refund_requests
     SET status = 'approved',
         admin_notes = COALESCE(_admin_notes, admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = _refund_id;

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (_refund.customer_id, 'Refund approved',
          'Your refund of $' || to_char(_refund.amount, 'FM999990.00') || ' has been credited to your wallet.',
          'success',
          jsonb_build_object('refund_id', _refund.id, 'booking_id', _refund.booking_id, 'amount', _refund.amount));

  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (auth.uid(), 'refund.approved', 'refund_request', _refund.id::text, _refund.customer_id,
          jsonb_build_object('amount', _refund.amount, 'booking_id', _refund.booking_id, 'admin_notes', _admin_notes));

  RETURN jsonb_build_object('success', true, 'refund_id', _refund.id, 'credited', _refund.amount, 'new_balance', _new_balance);
END;
$function$;

-- 3. Update mark_withdrawal_paid to log
CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid(_withdrawal_id uuid, _admin_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w withdrawals%ROWTYPE;
  _wallet_id uuid;
  _balance numeric;
  _new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can mark withdrawals as paid';
  END IF;

  SELECT * INTO _w FROM withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _w.status = 'paid' THEN RAISE EXCEPTION 'Withdrawal already paid'; END IF;

  INSERT INTO wallets (user_id) VALUES (_w.vendor_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT id, balance INTO _wallet_id, _balance
    FROM wallets WHERE user_id = _w.vendor_id FOR UPDATE;

  IF _balance < _w.amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance (have %, need %)', _balance, _w.amount;
  END IF;

  UPDATE wallets SET balance = balance - _w.amount, updated_at = now()
   WHERE id = _wallet_id RETURNING balance INTO _new_balance;

  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference_id)
  VALUES (_wallet_id, _w.vendor_id, 'withdrawal', -_w.amount,
          'Withdrawal paid (' || _w.payment_method || ')', _w.id::text);

  UPDATE withdrawals
     SET status = 'paid',
         admin_notes = COALESCE(_admin_notes, admin_notes),
         reviewed_by = COALESCE(reviewed_by, auth.uid()),
         reviewed_at = COALESCE(reviewed_at, now()),
         paid_at = now(),
         updated_at = now()
   WHERE id = _withdrawal_id;

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (_w.vendor_id, 'Withdrawal paid',
          'Your withdrawal of $' || to_char(_w.amount, 'FM999990.00') || ' has been processed.',
          'success',
          jsonb_build_object('withdrawal_id', _w.id, 'amount', _w.amount, 'method', _w.payment_method));

  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (auth.uid(), 'withdrawal.paid', 'withdrawal', _w.id::text, _w.vendor_id,
          jsonb_build_object('amount', _w.amount, 'method', _w.payment_method, 'admin_notes', _admin_notes));

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _w.id, 'debited', _w.amount, 'new_balance', _new_balance);
END;
$$;

-- 4. Trigger to log role grants/revokes
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (auth.uid(), 'role.granted', 'user_role', NEW.id::text, NEW.user_id,
            jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (auth.uid(), 'role.revoked', 'user_role', OLD.id::text, OLD.user_id,
            jsonb_build_object('role', OLD.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_role_change ON public.user_roles;
CREATE TRIGGER trg_log_user_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();