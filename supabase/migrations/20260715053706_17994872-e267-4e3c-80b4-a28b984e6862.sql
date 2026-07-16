
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS profiles_lat_lng_idx
  ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nearby_providers(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision DEFAULT 25
)
RETURNS TABLE (
  user_id uuid,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      p.user_id,
      -- Haversine distance in kilometers (earth radius 6371 km)
      2 * 6371 * asin(
        sqrt(
          power(sin(radians((p.latitude - center_lat) / 2)), 2)
          + cos(radians(center_lat)) * cos(radians(p.latitude))
            * power(sin(radians((p.longitude - center_lng) / 2)), 2)
        )
      ) AS distance_km
    FROM public.profiles p
    JOIN public.user_roles ur
      ON ur.user_id = p.user_id AND ur.role = 'provider'
    WHERE p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND coalesce(p.deleted_at::text, '') = ''
  )
  SELECT user_id, distance_km
  FROM candidates
  WHERE distance_km <= radius_km
  ORDER BY distance_km ASC;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_providers(double precision, double precision, double precision) TO anon, authenticated;
