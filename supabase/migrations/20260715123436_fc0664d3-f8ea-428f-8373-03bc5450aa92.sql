-- Structured checklist of items an admin asks the employer/vendor to fix.
-- Each entry: { kind: 'doc'|'field', key: text, label: text }
ALTER TABLE public.vendor_verifications
  ADD COLUMN IF NOT EXISTS info_request_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Rewrite the history trigger so info_requested transitions record the requested
-- item labels in the `reasons` array (the timeline UI already renders these).
CREATE OR REPLACE FUNCTION public.log_verification_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event TEXT;
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_doc_fields TEXT[] := ARRAY[
    'government_id_url','proof_of_address_url','police_clearance_url',
    'business_registration_url','tax_certificate_url','insurance_url',
    'professional_license_url'
  ];
  v_field TEXT;
  v_old TEXT;
  v_new TEXT;
  v_reasons TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.verification_status_history(
      verification_id, vendor_id, from_status, to_status, event, actor_id, actor_role
    ) VALUES (
      NEW.id, NEW.vendor_id, NULL, NEW.status, 'created', v_actor, 'vendor'
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending' AND OLD.status IN ('rejected','info_requested') THEN
      v_event := 'resubmitted'; v_role := 'vendor';
    ELSIF NEW.status = 'pending' AND OLD.status = 'draft' THEN
      v_event := 'submitted'; v_role := 'vendor';
    ELSIF NEW.status = 'approved' THEN
      v_event := 'approved'; v_role := 'admin';
    ELSIF NEW.status = 'rejected' THEN
      v_event := 'rejected'; v_role := 'admin';
    ELSIF NEW.status = 'info_requested' THEN
      v_event := 'info_requested'; v_role := 'admin';
    ELSIF NEW.status = 'expired' THEN
      v_event := 'expired'; v_role := 'system';
    ELSE
      v_event := 'status_change'; v_role := 'system';
    END IF;

    IF v_event = 'info_requested' THEN
      SELECT COALESCE(array_agg(elem->>'label' ORDER BY ord), ARRAY[]::text[])
        INTO v_reasons
        FROM jsonb_array_elements(COALESCE(NEW.info_request_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        WHERE elem ? 'label';
    ELSE
      v_reasons := NEW.rejection_reasons;
    END IF;

    INSERT INTO public.verification_status_history(
      verification_id, vendor_id, from_status, to_status, event, note, reasons, actor_id, actor_role
    ) VALUES (
      NEW.id, NEW.vendor_id, OLD.status, NEW.status, v_event,
      COALESCE(NEW.rejection_note, NEW.info_request_note),
      v_reasons, v_actor, v_role
    );
  END IF;

  FOREACH v_field IN ARRAY v_doc_fields LOOP
    EXECUTE format('SELECT ($1).%I, ($2).%I', v_field, v_field)
      INTO v_old, v_new USING OLD, NEW;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.verification_status_history(
        verification_id, vendor_id, from_status, to_status, event, note, actor_id, actor_role
      ) VALUES (
        NEW.id, NEW.vendor_id, NEW.status, NEW.status,
        CASE
          WHEN v_old IS NULL THEN 'document_uploaded'
          WHEN v_new IS NULL THEN 'document_removed'
          ELSE 'document_replaced'
        END,
        v_field || ': ' ||
          COALESCE(regexp_replace(v_old, '.*/', ''), '(none)') || ' → ' ||
          COALESCE(regexp_replace(v_new, '.*/', ''), '(none)'),
        v_actor, 'vendor'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;