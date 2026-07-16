
CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid(_withdrawal_id uuid, _admin_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Auto-reject if wallet is short. Update + notify + audit, then raise so the admin still sees the error.
  IF _balance < _w.amount THEN
    UPDATE withdrawals
       SET status = 'denied',
           admin_notes = 'auto: insufficient balance',
           reviewed_by = COALESCE(reviewed_by, auth.uid()),
           reviewed_at = COALESCE(reviewed_at, now()),
           updated_at = now()
     WHERE id = _withdrawal_id;

    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      _w.vendor_id,
      'Withdrawal rejected',
      'Your withdrawal of $' || to_char(_w.amount, 'FM999990.00')
        || ' was auto-rejected: insufficient wallet balance.',
      'warning',
      jsonb_build_object(
        'withdrawal_id', _w.id,
        'amount', _w.amount,
        'reason', 'insufficient_balance',
        'wallet_balance', _balance
      )
    );

    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      auth.uid(),
      'withdrawal.auto_rejected',
      'withdrawal',
      _w.id::text,
      _w.vendor_id,
      jsonb_build_object(
        'amount', _w.amount,
        'method', _w.payment_method,
        'wallet_balance', _balance,
        'reason', 'insufficient_balance'
      )
    );

    RAISE EXCEPTION 'Insufficient wallet balance (have %, need %) — withdrawal auto-rejected',
      _balance, _w.amount;
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
$function$;
