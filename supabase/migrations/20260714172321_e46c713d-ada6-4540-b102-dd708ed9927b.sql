
-- 1) Enable Realtime delivery for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 2) Booking status-change notifications for both customer and provider
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := NULL;
  v_cust_msg text := NULL;
  v_prov_msg text := NULL;
  v_type text := 'info';
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') = COALESCE(NEW.status,'') THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      v_title := 'Booking confirmed';
      v_type := 'success';
      v_cust_msg := 'Your booking on ' || to_char(NEW.booking_date,'Mon DD') || ' has been confirmed by the provider.';
      v_prov_msg := 'You confirmed a booking for ' || to_char(NEW.booking_date,'Mon DD') || '.';
    WHEN 'in_progress' THEN
      v_title := 'Booking in progress';
      v_type := 'info';
      v_cust_msg := 'Your provider marked the booking as in progress.';
      v_prov_msg := 'You marked the booking as in progress.';
    WHEN 'completed' THEN
      v_title := 'Booking completed';
      v_type := 'success';
      v_cust_msg := 'Your booking is complete. You can now leave a review.';
      v_prov_msg := 'You marked the booking as completed.';
    WHEN 'cancelled' THEN
      v_title := 'Booking cancelled';
      v_type := 'warning';
      v_cust_msg := 'Your booking on ' || to_char(NEW.booking_date,'Mon DD') || ' was cancelled.';
      v_prov_msg := 'A booking on ' || to_char(NEW.booking_date,'Mon DD') || ' was cancelled.';
    WHEN 'reschedule_requested' THEN
      v_title := 'Reschedule requested';
      v_type := 'info';
      v_cust_msg := 'A reschedule was requested on your booking.';
      v_prov_msg := 'A reschedule was requested on the booking.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.customer_id, v_title, v_cust_msg, v_type,
    jsonb_build_object('event','booking.'||NEW.status,'booking_id',NEW.id,'previous_status',OLD.status,'new_status',NEW.status)
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.vendor_id, v_title, v_prov_msg, v_type,
    jsonb_build_object('event','booking.'||NEW.status,'booking_id',NEW.id,'previous_status',OLD.status,'new_status',NEW.status)
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_booking_status_change ON public.bookings;
CREATE TRIGGER trg_notify_booking_status_change
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

-- 3) Proposal status-change notifications
CREATE OR REPLACE FUNCTION public.notify_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
  v_customer_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') = COALESCE(NEW.status,'') THEN RETURN NEW; END IF;

  SELECT title, customer_id INTO v_task_title, v_customer_id
    FROM public.tasks WHERE id = NEW.task_id;

  IF NEW.status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'Proposal accepted',
      'Your proposal for "' || COALESCE(v_task_title,'a job') || '" was accepted.',
      'success',
      jsonb_build_object('event','proposal.accepted','task_id',NEW.task_id,'proposal_id',NEW.id)
    );

  ELSIF NEW.status = 'declined' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'Proposal declined',
      'Your proposal for "' || COALESCE(v_task_title,'a job') || '" was declined.',
      'warning',
      jsonb_build_object('event','proposal.declined','task_id',NEW.task_id,'proposal_id',NEW.id)
    );

  ELSIF NEW.status = 'shortlisted' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'You were shortlisted',
      'The customer shortlisted your proposal on "' || COALESCE(v_task_title,'a job') || '".',
      'info',
      jsonb_build_object('event','proposal.shortlisted','task_id',NEW.task_id,'proposal_id',NEW.id)
    );

  ELSIF NEW.status = 'withdrawn' AND COALESCE(OLD.status,'') = 'accepted' AND v_customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_customer_id,
      'Provider withdrew',
      'The accepted provider withdrew from "' || COALESCE(v_task_title,'your job') || '".',
      'warning',
      jsonb_build_object('event','proposal.withdrawn','task_id',NEW.task_id,'proposal_id',NEW.id)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_proposal_status_change ON public.task_proposals;
CREATE TRIGGER trg_notify_proposal_status_change
AFTER UPDATE OF status ON public.task_proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_status_change();
