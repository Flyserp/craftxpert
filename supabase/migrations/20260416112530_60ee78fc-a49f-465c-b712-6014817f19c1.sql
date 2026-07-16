ALTER TABLE public.service_categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 AS rn
  FROM public.service_categories
)
UPDATE public.service_categories sc
SET sort_order = ranked.rn
FROM ranked
WHERE sc.id = ranked.id;