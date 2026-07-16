-- Private bucket for booking receipt PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Customers can read their own booking receipts
CREATE POLICY "Customers can read own booking receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id::text = split_part(storage.objects.name, '.', 1)
      AND b.customer_id = auth.uid()
  )
);

-- Vendors can read receipts for bookings on their services
CREATE POLICY "Vendors can read own booking receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id::text = split_part(storage.objects.name, '.', 1)
      AND b.vendor_id = auth.uid()
  )
);

-- Admins can read all booking receipts
CREATE POLICY "Admins can read all booking receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);