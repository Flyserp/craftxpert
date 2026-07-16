import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Heading, SponsoredBadge } from "@/components/ui/app";
import {
  DEFAULT_WEIGHTS,
  loadRankingWeights,
  scoreProvider,
  type RankableProvider,
  type RankingWeights,
} from "@/lib/searchRanking";

type Row = {
  user_id: string;
  display_name: string | null;
  business_name: string | null;
  address: string | null;
  avatar_url: string | null;
  is_featured: boolean | null;
  updated_at: string | null;
};

type Ranked = Row & {
  score: number;
  rating: number;
  reviews: number;
  jobs: number;
  sponsored: boolean;
  verified: boolean;
};

async function rankProviders(rows: Row[], weights: RankingWeights): Promise<Ranked[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.user_id);
  const [reviewsRes, bookingsRes, sponsoredRes, subsRes, verifiedRes] = await Promise.all([
    supabase.from("reviews").select("vendor_id, rating").in("vendor_id", ids),
    supabase
      .from("bookings")
      .select("vendor_id, status")
      .in("vendor_id", ids)
      .eq("status", "completed"),
    supabase
      .from("vendor_services")
      .select("vendor_id, is_sponsored, sponsored_until")
      .in("vendor_id", ids)
      .eq("is_sponsored", true),
    supabase
      .from("provider_subscriptions")
      .select("provider_id, status, current_period_end")
      .in("provider_id", ids)
      .eq("status", "active"),
    supabase
      .from("vendor_verifications")
      .select("vendor_id, status, expires_at")
      .in("vendor_id", ids)
      .eq("status", "approved"),
  ]);

  const ratingMap = new Map<string, { sum: number; n: number }>();
  (reviewsRes.data ?? []).forEach((r: any) => {
    const m = ratingMap.get(r.vendor_id) ?? { sum: 0, n: 0 };
    m.sum += Number(r.rating ?? 0);
    m.n += 1;
    ratingMap.set(r.vendor_id, m);
  });
  const jobsMap = new Map<string, number>();
  (bookingsRes.data ?? []).forEach((b: any) => {
    jobsMap.set(b.vendor_id, (jobsMap.get(b.vendor_id) ?? 0) + 1);
  });
  const now = Date.now();
  const sponsoredSet = new Set(
    (sponsoredRes.data ?? [])
      .filter((s: any) => !s.sponsored_until || new Date(s.sponsored_until).getTime() > now)
      .map((s: any) => s.vendor_id),
  );
  const subSet = new Set(
    (subsRes.data ?? [])
      .filter((s: any) => !s.current_period_end || new Date(s.current_period_end).getTime() > now)
      .map((s: any) => s.provider_id),
  );
  const verifiedSet = new Set(
    (verifiedRes.data ?? [])
      .filter((v: any) => !v.expires_at || new Date(v.expires_at).getTime() > now)
      .map((v: any) => v.vendor_id),
  );

  return rows
    .map((r) => {
      const rs = ratingMap.get(r.user_id) ?? { sum: 0, n: 0 };
      const avg = rs.n ? rs.sum / rs.n : 0;
      const jobs = jobsMap.get(r.user_id) ?? 0;
      const sponsored = sponsoredSet.has(r.user_id);
      const verified = verifiedSet.has(r.user_id);
      const rankable: RankableProvider = {
        sponsored,
        verified,
        avg_rating: avg,
        completed_jobs: jobs,
        has_active_subscription: subSet.has(r.user_id),
        last_active_at: r.updated_at,
      };
      let score = scoreProvider(rankable, weights);
      if (r.is_featured) score += 4;
      return { ...r, score, rating: avg, reviews: rs.n, jobs, sponsored, verified };
    })
    .sort((a, b) => b.score - a.score);
}

function ProviderCard({ p }: { p: Ranked }) {
  const name = p.business_name || p.display_name || "Provider";
  return (
    <Link
      to={`/provider/${p.user_id}`}
      className="block rounded-sm border border-border bg-card p-3 transition-colors hover:border-primary"
    >
      <div className="flex items-center gap-3">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={name} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-fs-sm font-medium">{name}</span>
          {p.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </div>
          <div className="text-description-sm flex items-center gap-2 truncate">
            {p.rating > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-current" /> {p.rating.toFixed(1)}
                {p.reviews > 0 && <span className="opacity-70">({p.reviews})</span>}
              </span>
            )}
            {p.address && (
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{p.address}</span>
              </span>
            )}
          </div>
        </div>
        <SponsoredBadge isSponsored={p.sponsored} />
      </div>
    </Link>
  );
}

interface BaseProps {
  limit?: number;
  title?: string;
  className?: string;
}

/** Recommended providers — globally ranked, optionally filtered by location. */
export function RecommendedProviders({
  limit = 6,
  title = "Recommended for you",
  city,
  className,
}: BaseProps & { city?: string | null }) {
  const [items, setItems] = useState<Ranked[] | null>(null);

  useEffect(() => {
    (async () => {
      const weights = await loadRankingWeights().catch(() => DEFAULT_WEIGHTS);
      const providerRoles = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "provider" as any);
      const ids = (providerRoles.data ?? []).map((r) => r.user_id);
      if (!ids.length) return setItems([]);
      let qb = supabase
        .from("profiles")
        .select(
          "user_id,display_name,business_name,address,avatar_url,is_featured,updated_at",
        )
        .in("user_id", ids)
        .limit(40);
      if (city) qb = qb.ilike("address", `%${city}%`);
      const { data } = await qb;
      const ranked = await rankProviders((data ?? []) as Row[], weights);
      setItems(ranked.slice(0, limit));
    })().catch(() => setItems([]));
  }, [limit, city]);

  if (!items || items.length === 0) return null;
  return (
    <Card className={`p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Heading level={3}  className="text-subheading">{title}</Heading>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((p) => (
          <ProviderCard key={p.user_id} p={p} />
        ))}
      </div>
    </Card>
  );
}

/** Related providers — same category as the current provider, ranked. */
export function RelatedProviders({
  providerId,
  limit = 4,
  title = "Related providers",
  className,
}: BaseProps & { providerId: string }) {
  const [items, setItems] = useState<Ranked[] | null>(null);

  useEffect(() => {
    (async () => {
      const weights = await loadRankingWeights().catch(() => DEFAULT_WEIGHTS);
      // Find category ids the provider serves
      const { data: myServices } = await supabase
        .from("vendor_services")
        .select("category_id")
        .eq("vendor_id", providerId)
        .eq("is_active", true);
      const catIds = Array.from(
        new Set((myServices ?? []).map((s: any) => s.category_id).filter(Boolean)),
      );
      if (!catIds.length) return setItems([]);
      const { data: peers } = await supabase
        .from("vendor_services")
        .select("vendor_id")
        .in("category_id", catIds)
        .eq("is_active", true)
        .neq("vendor_id", providerId);
      const peerIds = Array.from(new Set((peers ?? []).map((p: any) => p.vendor_id))).slice(0, 30);
      if (!peerIds.length) return setItems([]);
      const { data: profs } = await supabase
        .from("profiles")
        .select(
          "user_id,display_name,business_name,address,avatar_url,is_featured,updated_at",
        )
        .in("user_id", peerIds);
      const ranked = await rankProviders((profs ?? []) as Row[], weights);
      setItems(ranked.slice(0, limit));
    })().catch(() => setItems([]));
  }, [providerId, limit]);

  if (!items || items.length === 0) return null;
  return (
    <Card className={`p-4 space-y-3 ${className ?? ""}`}>
      <Heading level={3}  className="text-subheading">{title}</Heading>
      <div className="grid gap-2">
        {items.map((p) => (
          <ProviderCard key={p.user_id} p={p} />
        ))}
      </div>
    </Card>
  );
}