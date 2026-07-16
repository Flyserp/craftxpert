
-- Prevent deletion of protected bookings unless explicit override is set
CREATE OR REPLACE FUNCTION public.prevent_protected_booking_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('accepted', 'confirmed', 'completed') THEN
    IF COALESCE(current_setting('app.allow_booking_delete', true), '') <> 'on' THEN
      RAISE EXCEPTION 'Cannot delete booking % with status %. Set app.allow_booking_delete = ''on'' to override.', OLD.id, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_protected_booking_delete ON public.bookings;
CREATE TRIGGER trg_prevent_protected_booking_delete
BEFORE DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_protected_booking_delete();
