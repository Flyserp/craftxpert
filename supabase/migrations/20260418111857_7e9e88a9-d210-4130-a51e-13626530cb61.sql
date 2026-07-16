-- Atomic refund approval: marks refund approved, credits customer wallet,
-- logs a wallet transaction, and creates a notification. Admin-only.
CREATE OR REPLACE FUNCTION public.approve_refund(
  _refund_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _refund refund_requests%ROWTYPE;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  -- Only admins
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve refunds';
  END IF;

  SELECT * INTO _refund FROM refund_requests WHERE id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund request not found';
  END IF;

  IF _refund.status = 'approved' THEN
    RAISE EXCEPTION 'Refund already approved';
  END IF;

  -- Ensure wallet exists, then credit it
  INSERT INTO wallets (user_id) VALUES (_refund.customer_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallets
     SET balance = balance + _refund.amount,
         updated_at = now()
   WHERE user_id = _refund.customer_id
   RETURNING id, balance INTO _wallet_id, _new_balance;

  -- Log wallet transaction
  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference_id)
  VALUES (
    _wallet_id,
    _refund.customer_id,
    'refund',
    _refund.amount,
    'Refund approved for booking ' || substr(_refund.booking_id::text, 1, 8),
    _refund.id::text
  );

  -- Mark refund approved
  UPDATE refund_requests
     SET status = 'approved',
         admin_notes = COALESCE(_admin_notes, admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = _refund_id;

  -- Notify the customer
  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (
    _refund.customer_id,
    'Refund approved',
    'Your refund of $' || to_char(_refund.amount, 'FM999990.00') || ' has been credited to your wallet.',
    'success',
    jsonb_build_object(
      'refund_id', _refund.id,
      'booking_id', _refund.booking_id,
      'amount', _refund.amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_id', _refund.id,
    'credited', _refund.amount,
    'new_balance', _new_balance
  );
END;
$$;