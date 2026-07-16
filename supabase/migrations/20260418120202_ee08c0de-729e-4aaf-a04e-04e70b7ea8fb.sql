-- Enforce wallet-balance cap on withdrawal requests at the database level
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_wallet_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_balance numeric;
  _pending_total numeric;
  _available numeric;
BEGIN
  -- Ensure wallet exists (defensive)
  INSERT INTO public.wallets (user_id) VALUES (NEW.vendor_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO _wallet_balance
    FROM public.wallets WHERE user_id = NEW.vendor_id;

  -- Sum of other pending/approved withdrawals already reserving wallet funds
  SELECT COALESCE(SUM(amount), 0) INTO _pending_total
    FROM public.withdrawals
   WHERE vendor_id = NEW.vendor_id
     AND status IN ('pending', 'approved');

  _available := COALESCE(_wallet_balance, 0) - COALESCE(_pending_total, 0);

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Withdrawal exceeds available wallet balance (requested %, available %)',
      NEW.amount, _available
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_withdrawal_wallet_cap ON public.withdrawals;

CREATE TRIGGER trg_enforce_withdrawal_wallet_cap
BEFORE INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_withdrawal_wallet_cap();