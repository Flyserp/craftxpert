
ALTER TABLE public.vendor_verifications
  ADD COLUMN IF NOT EXISTS police_clearance_url text,
  ADD COLUMN IF NOT EXISTS tax_certificate_url text,
  ADD COLUMN IF NOT EXISTS info_request_note text;

DROP POLICY IF EXISTS "Vendors can update own draft or rejected" ON public.vendor_verifications;
CREATE POLICY "Vendors can update own editable verification"
  ON public.vendor_verifications
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND status = ANY (ARRAY['draft'::verification_status, 'rejected'::verification_status, 'info_requested'::verification_status])
  )
  WITH CHECK (
    vendor_id = auth.uid()
    AND status = ANY (ARRAY['draft'::verification_status, 'pending'::verification_status])
  );
