
CREATE TABLE IF NOT EXISTS public.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  query_normalized text GENERATED ALWAYS AS (lower(btrim(query))) STORED,
  result_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.search_queries TO authenticated;
GRANT SELECT, INSERT ON public.search_queries TO anon;
GRANT ALL ON public.search_queries TO service_role;

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own searches"
  ON public.search_queries FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users read their own searches"
  ON public.search_queries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users delete their own searches"
  ON public.search_queries FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all searches"
  ON public.search_queries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS search_queries_normalized_idx
  ON public.search_queries (query_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS search_queries_user_idx
  ON public.search_queries (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.popular_searches(_limit int DEFAULT 8, _since_days int DEFAULT 30)
RETURNS TABLE(query text, hits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT query_normalized AS query, COUNT(*) AS hits
    FROM public.search_queries
   WHERE created_at > now() - make_interval(days => _since_days)
     AND length(query_normalized) >= 2
   GROUP BY query_normalized
   ORDER BY hits DESC, query
   LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.search_suggestions(_prefix text, _limit int DEFAULT 6)
RETURNS TABLE(query text, hits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT query_normalized AS query, COUNT(*) AS hits
    FROM public.search_queries
   WHERE query_normalized LIKE lower(btrim(_prefix)) || '%'
     AND length(query_normalized) >= 2
   GROUP BY query_normalized
   ORDER BY hits DESC, query
   LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.popular_searches(int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_suggestions(text, int) TO anon, authenticated;
