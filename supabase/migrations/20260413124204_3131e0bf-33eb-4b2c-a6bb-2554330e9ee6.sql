
ALTER TABLE public.bookings DISABLE TRIGGER update_bookings_updated_at;
UPDATE public.bookings 
SET updated_at = '2026-04-12T12:10:00+00:00'
WHERE id = 'd7942042-438f-47ba-ab16-15915e9b4ec6';
ALTER TABLE public.bookings ENABLE TRIGGER update_bookings_updated_at;
