import { supabase } from "@/integrations/supabase/client";

/** Best-effort fire-and-forget logger for executed searches. */
export async function logSearchQuery(query: string, resultCount = 0) {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("search_queries").insert({
      user_id: userData.user?.id ?? null,
      query: q,
      result_count: resultCount,
    });
  } catch {
    /* ignore */
  }
}

export async function fetchPopularSearches(limit = 8): Promise<string[]> {
  const { data, error } = await supabase.rpc("popular_searches", {
    _limit: limit,
    _since_days: 30,
  });
  if (error || !data) return [];
  return (data as Array<{ query: string }>).map((r) => r.query);
}

export async function fetchSearchSuggestions(prefix: string, limit = 6): Promise<string[]> {
  const p = prefix.trim();
  if (p.length < 2) return [];
  const { data, error } = await supabase.rpc("search_suggestions", {
    _prefix: p,
    _limit: limit,
  });
  if (error || !data) return [];
  return (data as Array<{ query: string }>).map((r) => r.query);
}