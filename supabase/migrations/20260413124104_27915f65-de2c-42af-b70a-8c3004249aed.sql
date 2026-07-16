UPDATE public.bookings 
SET updated_at = now() - interval '24 hours 30 minutes' 
WHERE id = 'd7942042-438f-47ba-ab16-15915e9b4ec6';