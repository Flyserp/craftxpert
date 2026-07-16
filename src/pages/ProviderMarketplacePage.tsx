import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, MapPin, CheckCircle2, Briefcase, Clock, Search, SlidersHorizontal, X, Heart, LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { distanceKm, geocodeAddress, getBrowserLocation, type LatLng } from "@/lib/geo";
import SEOHead from "@/components/SEOHead";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WEIGHTS,
  loadRankingWeights,
  scoreProvider,
  type RankingWeights,
} from "@/lib/searchRanking";
import { Heading } from "@/components/ui/app";

interface ProviderRow {
  vendor_id: string;
  display_name: string;
  avatar_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  verified: boolean;
  avg_rating: number;
  review_count: number;
  completed_jobs: number;
  starting_price: number | null;
  price_type: string | null;
  available_slots: number;
  experience_years: number;
  created_at: string;
  on_vacation: boolean;
  has_active_subscription: boolean;
  last_active_at: string | null;
  score: number;
  distance_km: number | null;
}

const ProviderMarketplacePage = () => {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [location, setLocation] = useState("");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [resolvingOrigin, setResolvingOrigin] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [minExperience, setMinExperience] = useState(0);
  const [sort, setSort] = useState<"smart" | "rating" | "newest" | "nearest" | "jobs">("smart");
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);

  const useMyLocation = async () => {
    setResolvingOrigin(true);
    const pt = await getBrowserLocation();
    setResolvingOrigin(false);
    if (!pt) {
      toast.error("Couldn't get your location. Try typing an address instead.");
      return;
    }
    setOrigin(pt);
    setOriginLabel("My current location");
    setSort("nearest");
  };

  const applyAddressAsOrigin = async () => {
    const q = location.trim();
    if (!q) {
      setOrigin(null);
      setOriginLabel("");
      return;
    }
    setResolvingOrigin(true);
    const pt = await geocodeAddress(q);
    setResolvingOrigin(false);
    if (!pt) {
      toast.error("We couldn't find that place. Try a more specific address.");
      return;
    }
    setOrigin(pt);
    setOriginLabel(q);
    setSort("nearest");
  };

  const clearOrigin = () => {
    setOrigin(null);
    setOriginLabel("");
    setLocation("");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "provider");
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        setProviders([]);
        setLoading(false);
        return;
      }

      const [profilesRes, servicesRes, reviewsRes, bookingsRes, availRes, verifRes, catsRes, subsRes, w] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, address, latitude, longitude, experience_years, created_at, updated_at, vacation_mode, vacation_until")
          .in("user_id", ids),
        supabase
          .from("vendor_services")
          .select("vendor_id, price_min, price_type, is_active, category_id, is_sponsored, sponsored_until, service_categories(name)")
          .in("vendor_id", ids)
          .eq("is_active", true),
        supabase.from("reviews").select("vendor_id, rating").in("vendor_id", ids),
        supabase.from("bookings").select("vendor_id, status").in("vendor_id", ids).eq("status", "completed"),
        supabase.from("vendor_availability").select("vendor_id, is_available").in("vendor_id", ids).eq("is_available", true),
        supabase
          .from("vendor_verifications")
          .select("vendor_id, status, expires_at")
          .in("vendor_id", ids)
          .eq("status", "approved"),
        supabase.from("service_categories").select("name").order("name"),
        supabase
          .from("provider_subscriptions")
          .select("provider_id, status, current_period_end")
          .in("provider_id", ids)
          .eq("status", "active"),
        loadRankingWeights(),
      ]);
      setWeights(w);
      const now = Date.now();
      const activeSubs = new Set(
        (subsRes.data ?? [])
          .filter((s: any) => !s.current_period_end || new Date(s.current_period_end).getTime() > now)
          .map((s: any) => s.provider_id),
      );

      const sponsoredSet = new Set(
        (servicesRes.data ?? [])
          .filter(
            (s: any) =>
              s.is_sponsored &&
              (!s.sponsored_until || new Date(s.sponsored_until).getTime() > now),
          )
          .map((s: any) => s.vendor_id),
      );

      const verified = new Set(
        (verifRes.data ?? [])
          .filter((v: any) => !v.expires_at || new Date(v.expires_at).getTime() > now)
          .map((v: any) => v.vendor_id),
      );
      const ratings = new Map<string, { sum: number; n: number }>();
      (reviewsRes.data ?? []).forEach((r: any) => {
        const cur = ratings.get(r.vendor_id) ?? { sum: 0, n: 0 };
        cur.sum += r.rating || 0;
        cur.n += 1;
        ratings.set(r.vendor_id, cur);
      });
      const completed = new Map<string, number>();
      (bookingsRes.data ?? []).forEach((b: any) => completed.set(b.vendor_id, (completed.get(b.vendor_id) ?? 0) + 1));
      const slots = new Map<string, number>();
      (availRes.data ?? []).forEach((a: any) => slots.set(a.vendor_id, (slots.get(a.vendor_id) ?? 0) + 1));
      const svc = new Map<string, { price: number | null; type: string | null; cat: string | null }>();
      (servicesRes.data ?? []).forEach((s: any) => {
        const cur = svc.get(s.vendor_id);
        const price = s.price_min ?? null;
        if (!cur) {
          svc.set(s.vendor_id, { price, type: s.price_type, cat: s.service_categories?.name ?? null });
        } else {
          if (price != null && (cur.price == null || price < cur.price)) {
            cur.price = price;
            cur.type = s.price_type;
          }
          if (!cur.cat && s.service_categories?.name) cur.cat = s.service_categories.name;
        }
      });

      const rows: ProviderRow[] = (profilesRes.data ?? []).map((p: any) => {
        const r = ratings.get(p.user_id);
        const s = svc.get(p.user_id);
        const today = new Date().toISOString().slice(0, 10);
        const onVacation = !!p.vacation_mode && (!p.vacation_until || p.vacation_until >= today);
        const avg_rating = r ? Math.round((r.sum / r.n) * 10) / 10 : 0;
        const completed_jobs = completed.get(p.user_id) ?? 0;
        const has_active_subscription = activeSubs.has(p.user_id);
        const last_active_at = p.updated_at ?? p.created_at;
        const score = scoreProvider(
          {
            sponsored: sponsoredSet.has(p.user_id),
            verified: verified.has(p.user_id),
            avg_rating,
            completed_jobs,
            has_active_subscription,
            last_active_at,
          },
          w,
        );
        return {
          vendor_id: p.user_id,
          display_name: p.display_name || "Provider",
          avatar_url: p.avatar_url,
          address: p.address,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          category: s?.cat ?? null,
          verified: verified.has(p.user_id),
          avg_rating,
          review_count: r?.n ?? 0,
          completed_jobs,
          starting_price: s?.price ?? null,
          price_type: s?.type ?? null,
          available_slots: slots.get(p.user_id) ?? 0,
          experience_years: p.experience_years ?? 0,
          created_at: p.created_at,
          on_vacation: onVacation,
          has_active_subscription,
          last_active_at,
          score,
          distance_km: null,
        };
      });

      setProviders(rows);
      setCategories((catsRes.data ?? []).map((c: any) => c.name));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    // Subscription enforcement: only providers with an active subscription appear in search.
    let list = providers.filter((p) => p.has_active_subscription);

    // Attach distance from the chosen origin (if any).
    if (origin) {
      list = list.map((p) => ({
        ...p,
        distance_km:
          p.latitude != null && p.longitude != null
            ? distanceKm(origin, { lat: p.latitude, lng: p.longitude })
            : null,
      }));
    } else {
      list = list.map((p) => ({ ...p, distance_km: null }));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.display_name.toLowerCase().includes(q) ||
          (p.address ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q),
      );
    }
    if (category !== "All") list = list.filter((p) => p.category === category);

    // Radius filter — only applies when we have an origin.
    if (origin) {
      list = list.filter((p) => p.distance_km != null && p.distance_km <= radiusKm);
    } else if (location.trim()) {
      // Fallback substring match when we couldn't resolve the address to coordinates.
      const q = location.toLowerCase();
      list = list.filter((p) => (p.address ?? "").toLowerCase().includes(q));
    }

    if (minRating > 0) list = list.filter((p) => p.avg_rating >= minRating);
    if (verifiedOnly) list = list.filter((p) => p.verified);
    if (availableOnly) list = list.filter((p) => p.available_slots > 0 && !p.on_vacation);
    if (minExperience > 0) list = list.filter((p) => p.experience_years >= minExperience);
    list = list.filter((p) => {
      const price = p.starting_price;
      if (price == null) return priceRange[0] === 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    list = [...list].sort((a, b) => {
      if (sort === "smart") return b.score - a.score;
      if (sort === "rating") return b.avg_rating - a.avg_rating;
      if (sort === "jobs") return b.completed_jobs - a.completed_jobs;
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      // nearest: use real distance when available, then fall back to address label
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      if (a.distance_km != null) return -1;
      if (b.distance_km != null) return 1;
      return (a.address ?? "").localeCompare(b.address ?? "");
    });
    return list;
  }, [providers, origin, radiusKm, search, category, location, minRating, verifiedOnly, priceRange, availableOnly, minExperience, sort]);

  const resetFilters = () => {
    setSearch(""); setCategory("All"); setLocation(""); setMinRating(0);
    setVerifiedOnly(false); setPriceRange([0, 500]); setAvailableOnly(false); setMinExperience(0);
    setOrigin(null); setOriginLabel(""); setRadiusKm(25);
  };


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Browse Providers — TaskHive"
        description="Discover verified service providers near you. Compare ratings, jobs completed, and pricing."
        canonical="/providers"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Provider Marketplace",
          description: "Browse vetted service professionals — verified, rated, and ready to hire.",
          url: "/providers",
        }}
      />
      <UnifiedHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <header className="mb-6">
          <Heading level={1}  className="mb-2">Provider Marketplace</Heading>
          <p className="text-body text-muted-foreground">Browse vetted professionals — verified, rated, and ready to hire.</p>
        </header>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-card border border-border/60 rounded-sm p-4 space-y-5 h-fit lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <Heading level={2}  className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </Heading>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-fs-xs gap-1">
                <X className="w-3 h-3" /> Reset
              </Button>
            </div>

            <div>
              <Label className="text-fs-xs mb-1.5 block">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-fs-xs mb-1.5 block">Location</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="City or address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyAddressAsOrigin(); } }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={applyAddressAsOrigin}
                  disabled={resolvingOrigin || !location.trim()}
                  className="shrink-0 h-9"
                >
                  {resolvingOrigin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Set"}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                disabled={resolvingOrigin}
                className="w-full h-8 gap-1.5 text-fs-xs"
              >
                <LocateFixed className="w-3.5 h-3.5" /> Use my current location
              </Button>
              {origin && (
                <div className="rounded-sm border border-border/60 bg-muted/30 px-2 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {originLabel || "Coordinates set"}
                  </span>
                  <button
                    onClick={clearOrigin}
                    className="text-[11px] text-muted-foreground hover:text-heading"
                    aria-label="Clear origin"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div>
                <Label className="text-fs-xs mb-1.5 block">
                  Radius: {radiusKm} km {origin ? "" : <span className="text-muted-foreground/70">(needs a location)</span>}
                </Label>
                <Slider
                  min={1}
                  max={200}
                  step={1}
                  value={[radiusKm]}
                  onValueChange={(v) => setRadiusKm(v[0])}
                  disabled={!origin}
                />
              </div>
            </div>


            <div>
              <Label className="text-fs-xs mb-1.5 block">Minimum rating</Label>
              <div className="flex gap-1">
                {[0, 3, 4, 4.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`flex-1 text-fs-xs py-1.5 rounded-sm border ${minRating === r ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/40"}`}
                  >
                    {r === 0 ? "Any" : `${r}+`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-fs-xs mb-2 block">
                Price ${priceRange[0]} – ${priceRange[1]}{priceRange[1] === 500 ? "+" : ""}
              </Label>
              <Slider
                min={0} max={500} step={10}
                value={priceRange}
                onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
              />
            </div>

            <div>
              <Label className="text-fs-xs mb-1.5 block">Min experience: {minExperience} yrs</Label>
              <Slider min={0} max={20} step={1} value={[minExperience]} onValueChange={(v) => setMinExperience(v[0])} />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={verifiedOnly} onCheckedChange={(v) => setVerifiedOnly(!!v)} />
                <span className="text-fs-xs">Verified only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={availableOnly} onCheckedChange={(v) => setAvailableOnly(!!v)} />
                <span className="text-fs-xs">Available this week</span>
              </label>
            </div>
          </aside>

          <div>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Smart match</SelectItem>
                  <SelectItem value="rating">Highest rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="nearest">Nearest</SelectItem>
                  <SelectItem value="jobs">Most completed jobs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-fs-xs text-muted-foreground mb-4">{filtered.length} provider{filtered.length === 1 ? "" : "s"} found</p>

        {loading ? (
          <LoadingState title="Loading providers..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No providers found" description="Try adjusting your filters." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.vendor_id}
                onClick={() => navigate(`/provider/${p.vendor_id}`)}
                className="text-left bg-card border border-border/60 rounded-sm p-4 transition-all hover:border-primary/30 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.display_name} className="w-14 h-14 rounded-sm object-cover ring-1 ring-border/40" />
                  ) : (
                    <div className="w-14 h-14 rounded-sm bg-primary/8 flex items-center justify-center text-fs-base font-bold text-primary">
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Heading level={3}  className="truncate">{p.display_name}</Heading>
                      {p.verified && (
                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-[18px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </Badge>
                      )}
                    </div>
                    {p.category && <p className="text-fs-xs text-muted-foreground truncate">{p.category}</p>}
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-fs-xs font-semibold">{p.avg_rating > 0 ? p.avg_rating : "New"}</span>
                      {p.review_count > 0 && <span className="text-[11px] text-muted-foreground">({p.review_count})</span>}
                      {p.experience_years > 0 && (
                        <span className="text-[11px] text-muted-foreground ml-1">· {p.experience_years}y exp</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(p.vendor_id); }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors active:scale-95"
                    aria-label={isFavorite(p.vendor_id) ? "Remove from saved" : "Save provider"}
                  >
                    <Heart className={cn("w-4 h-4", isFavorite(p.vendor_id) ? "fill-destructive text-destructive" : "text-muted-foreground/60")} />
                  </button>
                </div>

                {p.address && (
                  <div className="flex items-center gap-1.5 text-fs-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.address}</span>
                    {p.distance_km != null && (
                      <span className="ml-auto shrink-0 rounded-sm bg-primary/8 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                        {p.distance_km < 1
                          ? `${Math.round(p.distance_km * 1000)} m`
                          : `${p.distance_km.toFixed(p.distance_km < 10 ? 1 : 0)} km`}
                      </span>
                    )}
                  </div>
                )}


                <div className="grid grid-cols-2 gap-2 text-fs-xs">
                  <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1.5 rounded-sm">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{p.completed_jobs} jobs done</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-sm ${p.available_slots > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{p.available_slots > 0 ? `${p.available_slots} slots/wk` : "Unavailable"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-fs-xs text-muted-foreground">Starting at</span>
                  <span className="text-fs-base font-bold text-heading tabular-nums">
                    {p.starting_price != null ? `$${p.starting_price}${p.price_type === "hourly" ? "/hr" : ""}` : "On request"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProviderMarketplacePage;