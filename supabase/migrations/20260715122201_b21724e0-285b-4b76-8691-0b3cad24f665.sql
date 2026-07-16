
-- 1. Store per-document validated metadata (size, mimetype, checked_at, error) for admin display
ALTER TABLE public.vendor_verifications
  ADD COLUMN IF NOT EXISTS document_status jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Validation trigger — runs on INSERT/UPDATE, inspects newly linked storage objects,
--    enforces mime/size, records metadata, and blocks submission when required docs are missing.
CREATE OR REPLACE FUNCTION public.validate_verification_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  doc_keys text[] := ARRAY[
    'government_id_url','proof_of_address_url','police_clearance_url',
    'business_registration_url','tax_certificate_url','insurance_url','professional_license_url'
  ];
  required_keys text[] := ARRAY['government_id_url','proof_of_address_url','police_clearance_url'];
  allowed_mimes text[] := ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
  max_bytes bigint := 10 * 1024 * 1024;  -- 10 MB
  k text;
  new_path text;
  old_path text;
  obj_size bigint;
  obj_mime text;
  status_map jsonb := COALESCE(NEW.document_status, '{}'::jsonb);
BEGIN
  FOREACH k IN ARRAY doc_keys LOOP
    EXECUTE format('SELECT ($1).%I, ($2).%I', k, k)
      INTO new_path, old_path
      USING NEW, CASE WHEN TG_OP = 'UPDATE' THEN OLD ELSE NULL END;

    -- Cleared field -> drop metadata
    IF new_path IS NULL THEN
      status_map := status_map - k;
      CONTINUE;
    END IF;

    -- Unchanged path -> keep existing metadata
    IF TG_OP = 'UPDATE' AND new_path IS NOT DISTINCT FROM old_path
       AND status_map ? k THEN
      CONTINUE;
    END IF;

    -- Look up the linked storage object
    SELECT (metadata->>'size')::bigint, metadata->>'mimetype'
      INTO obj_size, obj_mime
      FROM storage.objects
      WHERE bucket_id = 'verification-docs' AND name = new_path
      LIMIT 1;

    IF obj_size IS NULL THEN
      RAISE EXCEPTION 'Uploaded file for % is missing or inaccessible', k
        USING ERRCODE = 'check_violation';
    END IF;

    IF obj_size > max_bytes THEN
      RAISE EXCEPTION 'File for % is % bytes; maximum allowed is % bytes (10 MB)',
        k, obj_size, max_bytes
        USING ERRCODE = 'check_violation';
    END IF;

    IF obj_mime IS NULL OR NOT (lower(obj_mime) = ANY (allowed_mimes)) THEN
      RAISE EXCEPTION 'File type % for % is not allowed. Use JPG, PNG, WEBP, or PDF.',
        COALESCE(obj_mime, 'unknown'), k
        USING ERRCODE = 'check_violation';
    END IF;

    status_map := status_map || jsonb_build_object(
      k,
      jsonb_build_object(
        'size', obj_size,
        'mimetype', obj_mime,
        'checked_at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    );
  END LOOP;

  NEW.document_status := status_map;

  -- Enforce required docs when transitioning to pending (submit for review)
  IF NEW.status = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    FOREACH k IN ARRAY required_keys LOOP
      EXECUTE format('SELECT ($1).%I', k) INTO new_path USING NEW;
      IF new_path IS NULL THEN
        RAISE EXCEPTION 'Cannot submit verification: required document % is missing', k
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_verification_documents ON public.vendor_verifications;
CREATE TRIGGER trg_validate_verification_documents
  BEFORE INSERT OR UPDATE ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_verification_documents();
