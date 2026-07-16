import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Briefcase, Building2, LayoutGrid, MapPin, Loader2 } from "lucide-react";
import SearchSuggestionsPanel from "@/components/search/SearchSuggestionsPanel";
import { RecommendedProviders } from "@/components/search/ProviderRecommendations";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { logSearchQuery } from "@/lib/searchLog";
import { Heading } from "@/components/ui/app";

type GroupKey = "providers" | "employers" | "jobs" | "categories" | "locations";

type Hit = {
  id: string;
  title: string;
  subtitle?: string;
  to: string;
};

type Results = Record<GroupKey, Hit[]>;

const empty: Results = { providers: [], employers: [], jobs: [], categories: [], locations: [] };

const groupMeta: Record<GroupKey, { label: string; icon: any }> = {
  providers: { label: "Providers", icon: Users },
  employers: { label: "Employers", icon: Building2 },
  jobs: { label: "Jobs", icon: Briefcase },
  categories: { label: "Categories", icon: LayoutGrid },
  locations: { label: "Locations", icon: MapPin },
};

// Unwrap a Promise.allSettled result for a supabase query into a plain data
// array. A rejected promise OR a resolved-but-errored supabase response both
// degrade to []. This keeps one failing group (e.g. categories) from wiping
// out every other group in the search results.
function unwrap<T = any>(res: PromiseSettledResult<{ data: T[] | null; error?: any } | any>): T[] {
  if (res.status !== "fulfilled") {
    console.error("[GlobalSearch] query rejected", res.reason);
    return [];
  }
  const value: any = res.value;
  if (value?.error) {
    console.error("[GlobalSearch] query errored", value.error);
    return [];
  }
  return (value?.data ?? []) as T[];
}

async function runSearch(q: string): Promise<Results> {
  const like = `%${q}%`;
  const out: Results = { providers: [], employers: [], jobs: [], categories: [], locations: [] };

  // Providers + employers come from profiles filtered by role
  const [rolesProvider, rolesEmployer] = await Promise.allSettled([
    supabase.from("user_roles").select("user_id").eq("role", "provider" as any),
    supabase.from("user_roles").select("user_id").eq("role", "employer" as any),
  ]);
  const providerIds = unwrap<{ user_id: string }>(rolesProvider).map((r) => r.user_id);
  const employerIds = unwrap<{ user_id: string }>(rolesEmployer).map((r) => r.user_id);

  const [providers, employers, jobs, cats, subs, countries, provinces, cities] = await Promise.allSettled([
    providerIds.length
      ? supabase
          .from("profiles")
          .select("user_id,display_name,business_name,address")
          .in("user_id", providerIds)
          .or(`display_name.ilike.${like},business_name.ilike.${like}`)
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    employerIds.length
      ? supabase
          .from("profiles")
          .select("user_id,display_name,business_name,address")
          .in("user_id", employerIds)
          .or(`display_name.ilike.${like},business_name.ilike.${like}`)
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("tasks")
      .select("id,title,status,budget_max")
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(10),
    supabase.from("service_categories").select("id,name").ilike("name", like).limit(8),
    supabase.from("service_subcategories").select("id,name,slug,category_id").ilike("name", like).limit(8),
    supabase.from("countries").select("id,name").ilike("name", like).limit(6),
    supabase.from("provinces").select("id,name").ilike("name", like).limit(6),
    supabase.from("cities").select("id,name").ilike("name", like).limit(6),
  ]);

  out.providers = unwrap<any>(providers).map((p: any) => ({
    id: p.user_id,
    title: p.business_name || p.display_name || "Provider",
    subtitle: p.address || undefined,
    to: `/provider/${p.user_id}`,
  }));
  out.employers = unwrap<any>(employers).map((p: any) => ({
    id: p.user_id,
    title: p.business_name || p.display_name || "Employer",
    subtitle: p.address || undefined,
    to: `/employer/${p.user_id}`,
  }));
  out.jobs = unwrap<any>(jobs).map((j: any) => ({
    id: j.id,
    title: j.title,
    subtitle: j.status + (j.budget_max ? ` • up to $${j.budget_max}` : ""),
    to: `/tasks/${j.id}`,
  }));
  // Categories and subcategories are unwrapped independently so a failure
  // in one (e.g. a subcategory schema hiccup) never blanks the other.
  out.categories = [
    ...unwrap<any>(cats).map((c: any) => ({ id: c.id, title: c.name, subtitle: "Category", to: `/browse?category=${c.slug ?? c.id}` })),
    ...unwrap<any>(subs).map((c: any) => ({ id: c.id, title: c.name, subtitle: "Subcategory", to: `/browse?subcategory=${c.slug ?? c.id}` })),
  ];
  out.locations = [
    ...unwrap<any>(countries).map((c: any) => ({ id: c.id, title: c.name, subtitle: "Country", to: `/browse?country=${c.id}` })),
    ...unwrap<any>(provinces).map((c: any) => ({ id: c.id, title: c.name, subtitle: "Province", to: `/browse?province=${c.id}` })),
    ...unwrap<any>(cities).map((c: any) => ({ id: c.id, title: c.name, subtitle: "City", to: `/browse?city=${c.id}` })),
  ];

  return out;
}

export default function GlobalSearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? params.get("search") ?? "";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Results>(empty);
  const [loading, setLoading] = useState(false);
  const { push: pushRecent } = useRecentSearches();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(empty);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await runSearch(term);
        setResults(r);
        setParams({ q: term }, { replace: true });
        const totalHits = (Object.keys(r) as GroupKey[]).reduce((n, k) => n + r[k].length, 0);
        pushRecent(term);
        logSearchQuery(term, totalHits);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, setParams, pushRecent]);

  const total = useMemo(
    () => (Object.keys(results) as GroupKey[]).reduce((n, k) => n + results[k].length, 0),
    [results],
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <Heading level={1} >Search</Heading>
        <p className="text-description-sm">Find providers, employers, jobs, categories and locations.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type at least 2 characters…"
          className="pl-10 h-11"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {q.trim().length >= 2 && !loading && (
        <p className="text-description-sm">{total} result{total === 1 ? "" : "s"}</p>
      )}

      <SearchSuggestionsPanel query={q} onPick={(t) => setQ(t)} />

      <div className="space-y-4">
        {(Object.keys(groupMeta) as GroupKey[]).map((key) => {
          const hits = results[key];
          if (!hits.length) return null;
          const Icon = groupMeta[key].icon;
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {groupMeta[key].label}
                  <Badge variant="secondary" className="ml-1">{hits.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {hits.map((h) => (
                  <Link
                    key={`${key}-${h.id}`}
                    to={h.to}
                    className="flex items-center justify-between py-2.5 hover:bg-muted/40 px-2 -mx-2 rounded-sm"
                  >
                    <div>
                      <div className="font-medium">{h.title}</div>
                      {h.subtitle && <div className="text-description-sm">{h.subtitle}</div>}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {q.trim().length >= 2 && !loading && total === 0 && (
          <Card><CardContent className="py-10 text-center text-description-sm">No results found.</CardContent></Card>
        )}
      </div>

      {q.trim().length < 2 && <RecommendedProviders limit={6} />}
    </div>
  );
}