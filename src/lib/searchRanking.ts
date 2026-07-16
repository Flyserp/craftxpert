import { supabase } from "@/integrations/supabase/client";

export interface RankingWeights {
  sponsored: number;
  verified: number;
  rating: number;
  jobs: number;
  subscription: number;
  recency: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  sponsored: 40,
  verified: 25,
  rating: 20,
  jobs: 15,
  subscription: 10,
  recency: 10,
};

export const RANKING_SETTING_KEY = "search_ranking_weights";

export async function loadRankingWeights(): Promise<RankingWeights> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", RANKING_SETTING_KEY)
    .maybeSingle();
  if (!data?.value) return DEFAULT_WEIGHTS;
  try {
    return { ...DEFAULT_WEIGHTS, ...JSON.parse(data.value) };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export interface RankableProvider {
  /** Provider has at least one active (non-expired) sponsored service. */
  sponsored?: boolean;
  verified: boolean;
  avg_rating: number; // 0..5
  completed_jobs: number;
  has_active_subscription: boolean;
  last_active_at: string | null; // ISO
}

/** Returns a normalized 0..100 score. */
export function scoreProvider(p: RankableProvider, w: RankingWeights): number {
  const sponsored = p.sponsored ? 1 : 0;
  const verified = p.verified ? 1 : 0;
  const rating = Math.max(0, Math.min(5, p.avg_rating)) / 5;
  // Diminishing returns: 0 jobs → 0, 50+ jobs → ~1
  const jobs = 1 - Math.exp(-(p.completed_jobs || 0) / 25);
  const sub = p.has_active_subscription ? 1 : 0;
  // Recency: active today → 1, 30 days → ~0.5, 90+ days → ~0
  let recency = 0;
  if (p.last_active_at) {
    const days = (Date.now() - new Date(p.last_active_at).getTime()) / 86_400_000;
    recency = Math.max(0, 1 - days / 90);
  }
  const total =
    (w.sponsored ?? 0) + w.verified + w.rating + w.jobs + w.subscription + w.recency || 1;
  const raw =
    sponsored * (w.sponsored ?? 0) +
    verified * w.verified +
    rating * w.rating +
    jobs * w.jobs +
    sub * w.subscription +
    recency * w.recency;
  return Math.round((raw / total) * 1000) / 10; // 0..100, 1dp
}