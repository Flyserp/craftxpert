
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_wallet_cap_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_balance numeric;
  _pending_total numeric;
  _available numeric;
BEGIN
  -- Only enforce when amount is being raised on a non-terminal row
  IF NEW.amount <= OLD.amount THEN
    RETURN NEW;
  END IF;

  -- Don't gate updates on already-finalized rows (paid/denied)
  IF OLD.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT balance INTO _wallet_balance
    FROM public.wallets WHERE user_id = NEW.vendor_id;

  -- Sum of OTHER pending/approved withdrawals reserving wallet funds
  SELECT COALESCE(SUM(amount), 0) INTO _pending_total
    FROM public.withdrawals
   WHERE vendor_id = NEW.vendor_id
     AND status IN ('pending', 'approved')
     AND id <> NEW.id;

  _available := COALESCE(_wallet_balance, 0) - COALESCE(_pending_total, 0);

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'Withdrawal exceeds available wallet balance (requested %, available %)',
      NEW.amount, _available
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_withdrawal_wallet_cap_update_trg ON public.withdrawals;

CREATE TRIGGER enforce_withdrawal_wallet_cap_update_trg
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_withdrawal_wallet_cap_update();
