CREATE POLICY "Customers can delete their own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (auth.uid() = customer_id);