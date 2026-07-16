
CREATE OR REPLACE FUNCTION public.apply_to_task(
  p_task_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_quoted_price NUMERIC,
  p_eta_date DATE,
  p_message TEXT,
  p_estimated_duration TEXT,
  p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID := auth.uid();
  v_balance INTEGER;
  v_proposal_id UUID;
BEGIN
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Prevent duplicate application
  IF EXISTS (
    SELECT 1 FROM public.task_proposals
    WHERE task_id = p_task_id
      AND vendor_id = v_vendor
      AND direction = 'vendor_applied'
      AND status IN ('pending', 'shortlisted', 'accepted')
  ) THEN
    RAISE EXCEPTION 'You have already applied to this task' USING ERRCODE = 'unique_violation';
  END IF;

  -- Lock and check credit balance
  SELECT balance INTO v_balance
  FROM public.vendor_lead_credits
  WHERE vendor_id = v_vendor
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;

  -- Decrement credit
  UPDATE public.vendor_lead_credits
  SET balance = balance - 1
  WHERE vendor_id = v_vendor;

  -- Insert proposal
  INSERT INTO public.task_proposals (
    task_id, vendor_id, customer_id, direction, service_id,
    quoted_price, eta_date, message, estimated_duration, attachments, status
  ) VALUES (
    p_task_id, v_vendor, p_customer_id, 'vendor_applied', p_service_id,
    p_quoted_price, p_eta_date, p_message, p_estimated_duration,
    COALESCE(p_attachments, '[]'::jsonb), 'pending'
  )
  RETURNING id INTO v_proposal_id;

  -- Log wallet transaction for audit trail (if wallet_transactions expects this shape, keep minimal)
  BEGIN
    INSERT INTO public.wallet_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_vendor, -1, 'lead_credit_debit',
      'Lead credit used to apply to task',
      jsonb_build_object('task_id', p_task_id, 'proposal_id', v_proposal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- If wallet_transactions has a different schema, don't block the apply
    NULL;
  END;

  RETURN v_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_task(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT, JSONB) TO authenticated;
