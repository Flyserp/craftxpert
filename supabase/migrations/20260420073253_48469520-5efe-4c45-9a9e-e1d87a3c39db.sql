CREATE POLICY "Assigned staff can update booking status"
ON public.bookings
FOR UPDATE
TO authenticated
USING (assigned_staff_id = auth.uid())
WITH CHECK (assigned_staff_id = auth.uid());