import { useEffect, useState, useCallback } from "react";
import SEOHead from "@/components/SEOHead";
import { useSearchParams } from "react-router-dom";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, List, SlidersHorizontal, Map as MapIcon, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProviderCardData, BrowseFilters } from "@/components/browse/types";
import BrowseHero from "@/components/browse/BrowseHero";
import BrowseFilterSidebar from "@/components/browse/BrowseFilterSidebar";
import BrowsePagination from "@/components/browse/BrowsePagination";
import ActiveFilterChips from "@/components/browse/ActiveFilterChips";
import ProviderGridCard from "@/components/browse/ProviderGridCard";
import ProviderListCard from "@/components/browse/ProviderListCard";
import { withSubcategoryOverrides } from "@/lib/subcategoryOverrides";
import FeaturedProvidersRow from "@/components/browse/FeaturedProvidersRow";
import ProviderMapView from "@/components/browse/ProviderMapView";
import EmergencyToggle from "@/components/browse/EmergencyToggle";
import { useNearestVendorSlots } from "@/hooks/useNearestVendorSlots";
import TaxonomyVisibilityCheck from "@/components/taxonomy/TaxonomyVisibilityCheck";

interface SubCategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

const ITEMS_PER_PAGE = 12;

const BrowseServices = () => {
  const [searchParams] = useSearchParams();
  const [vendors, setVendors] = useState<ProviderCardData[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { toggleFavorite, isFavorite } = useFavorites();
  const isMobile = useIsMobile();

  const [filters, setFilters] = useState<BrowseFilters>({
    search: searchParams.get("search") || "",
    locationFilter: searchParams.get("location") || "",
    activeCategory: searchParams.get("category") || "All",
    activeSubcategory: searchParams.get("subcategory") || "All",
    sortBy: "relevance",
    priceRange: [0, 500],
    priceFilterActive: false,
    minRating: 0,
    availableOnly: false,
    emergencyMode: searchParams.get("emergency") === "1",
  });

  const updateFilter = useCallback(<K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "activeCategory" && value !== prev.activeCategory) {
        next.activeSubcategory = "All";
      }
      return next;
    });
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      search: "",
      locationFilter: "",
      activeCategory: "All",
      activeSubcategory: "All",
      sortBy: filters.sortBy,
      priceRange: [0, 500],
      priceFilterActive: false,
      minRating: 0,
      availableOnly: false,
      emergencyMode: false,
    });
    setCurrentPage(1);
  }, [filters.sortBy]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const todayDow = new Date().getDay();
    const next7Days = Array.from({ length: 7 }, (_, i) => (todayDow + i) % 7);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [catsRes, subsRes, servicesRes, reviewsRes, profilesRes, availRes, bookingsRes] = await Promise.all([
      supabase.from("service_categories").select("id, name, icon").order("name"),
      supabase.from("service_subcategories").select("id, name, slug, category_id, sort_order").order("name"),
      supabase.from("vendor_services").select("id, vendor_id, title, price_min, price_type, category_id, subcategory_id, is_active, is_sponsored, sponsored_until, category:service_categories(name)").eq("is_active", true),
      supabase.from("reviews").select("vendor_id, rating"),
      supabase.from("profiles").select("user_id, display_name, address, bio, avatar_url, is_featured, featured_until, featured_rank"),
      supabase.from("vendor_availability").select("vendor_id, day_of_week").eq("is_available", true).in("day_of_week", next7Days),
      supabase.from("bookings").select("vendor_id").gte("created_at", thirtyDaysAgo),
    ]);

    const cats = catsRes.data || [];
    const rawSubs = (subsRes.data || []) as SubCategory[];
    const subs = await withSubcategoryOverrides(rawSubs);
    const services = servicesRes.data || [];
    const reviews = reviewsRes.data || [];
    const profiles = profilesRes.data || [];
    const avail = availRes.data || [];
    const bookings = bookingsRes.data || [];
    const vendorPlanMap: Record<string, { plan_name: string; ranking_boost: number }> = {};

    setCategories(cats);
    setSubcategories(subs);

    const ratingMap: Record<string, { total: number; count: number }> = {};
    reviews.forEach((r) => {
      if (!ratingMap[r.vendor_id]) ratingMap[r.vendor_id] = { total: 0, count: 0 };
      ratingMap[r.vendor_id].total += r.rating;
      ratingMap[r.vendor_id].count += 1;
    });

    const profileMap: Record<string, any> = {};
    profiles.forEach((p) => { profileMap[p.user_id] = p; });

    const availMap: Record<string, number> = {};
    avail.forEach((a) => { availMap[a.vendor_id] = (availMap[a.vendor_id] || 0) + 1; });

    const bookingMap: Record<string, number> = {};
    bookings.forEach((b) => { bookingMap[b.vendor_id] = (bookingMap[b.vendor_id] || 0) + 1; });

    const vendorMap: Record<string, ProviderCardData> = {};
    services.forEach((s: any) => {
      if (!vendorMap[s.vendor_id]) {
        const p = profileMap[s.vendor_id];
        const r = ratingMap[s.vendor_id];
        const vp = vendorPlanMap[s.vendor_id];
        vendorMap[s.vendor_id] = {
          vendor_id: s.vendor_id,
          display_name: p?.display_name || "Provider",
          address: p?.address || null,
          bio: p?.bio || null,
          avatar_url: p?.avatar_url || null,
          services: [],
          avg_rating: r ? +(r.total / r.count).toFixed(1) : 0,
          review_count: r?.count || 0,
          categories: [],
          available_slots: availMap[s.vendor_id] || 0,
          bookings_30d: bookingMap[s.vendor_id] || 0,
          plan_name: vp?.plan_name || null,
          ranking_boost: vp?.ranking_boost || 0,
          is_sponsored: false,
          is_featured: !!p?.is_featured && (!p?.featured_until || new Date(p.featured_until) > new Date()),
        };
      }
      if (s.is_sponsored && s.sponsored_until && new Date(s.sponsored_until) > new Date()) {
        vendorMap[s.vendor_id].is_sponsored = true;
        const prev = vendorMap[s.vendor_id].sponsored_until;
        if (!prev || new Date(s.sponsored_until) > new Date(prev)) {
          vendorMap[s.vendor_id].sponsored_until = s.sponsored_until;
        }
      }
      const catName = s.category?.name || "Other";
      const subName = s.subcategory_id ? (subs.find((sc) => sc.id === s.subcategory_id)?.name || null) : null;
      vendorMap[s.vendor_id].services.push({
        id: s.id, title: s.title, price_min: s.price_min,
        price_type: s.price_type, category_name: catName,
        subcategory_id: s.subcategory_id || null,
        subcategory_name: subName,
      });
      if (!vendorMap[s.vendor_id].categories.includes(catName)) {
        vendorMap[s.vendor_id].categories.push(catName);
      }
    });

    setVendors(Object.values(vendorMap));
    setLoading(false);
  };

  // Filtering & sorting
  const { search, locationFilter, activeCategory, activeSubcategory, sortBy, priceRange, priceFilterActive, minRating, availableOnly, emergencyMode } = filters;

  // Compute soonest available slot per vendor (next 72h) — used by emergency mode.
  const vendorIdsForSlots = emergencyMode ? vendors.map((v) => v.vendor_id) : [];
  const { slots: nearestSlots } = useNearestVendorSlots(vendorIdsForSlots, 72);

  const filtered = vendors
    .filter((v) => {
      if (favoritesOnly && !isFavorite(v.vendor_id)) return false;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        v.display_name.toLowerCase().includes(searchLower) ||
        v.services.some((s) => s.title.toLowerCase().includes(searchLower)) ||
        (v.address && v.address.toLowerCase().includes(searchLower));
      const matchesCategory = activeCategory === "All" || v.categories.includes(activeCategory);
      const matchesSubcategory = activeSubcategory === "All" || (() => {
        const subId = subcategories.find((s) => s.name === activeSubcategory)?.id;
        return subId
          ? v.services.some((s) => s.subcategory_id === subId)
          : v.services.some((s) => s.title.toLowerCase().includes(activeSubcategory.toLowerCase()));
      })();
      const matchesLocation = !locationFilter.trim() || (v.address && (() => {
        const locWords = locationFilter.toLowerCase().split(/\s+/).filter(Boolean);
        const addrLower = v.address!.toLowerCase();
        return locWords.some((w) => addrLower.includes(w));
      })());
      const matchesPrice = !priceFilterActive || v.services.some((s) => {
        if (!s.price_min) return priceRange[0] === 0;
        return s.price_min >= priceRange[0] && s.price_min <= priceRange[1];
      });
      const matchesRating = minRating === 0 || v.avg_rating >= minRating;
      const matchesAvailability = !availableOnly || v.available_slots > 0;
      // Emergency: must have a nearest slot within 48h
      const slot = nearestSlots.get(v.vendor_id);
      const matchesEmergency = !emergencyMode || (slot !== undefined && slot.hoursFromNow <= 48);
      return matchesSearch && matchesCategory && matchesSubcategory && matchesLocation && matchesPrice && matchesRating && matchesAvailability && matchesEmergency;
    })
    .sort((a, b) => {
      // In emergency mode, soonest slot wins regardless of selected sort.
      if (emergencyMode) {
        const sa = nearestSlots.get(a.vendor_id)?.hoursFromNow ?? Infinity;
        const sb = nearestSlots.get(b.vendor_id)?.hoursFromNow ?? Infinity;
        if (sa !== sb) return sa - sb;
      }
      if (sortBy === "rating") return b.avg_rating - a.avg_rating || b.review_count - a.review_count;
      if (sortBy === "reviews") return b.review_count - a.review_count;
      if (sortBy === "booked") return b.bookings_30d - a.bookings_30d;
      if (sortBy === "price") {
        const aMin = Math.min(...a.services.map((s) => s.price_min || Infinity));
        const bMin = Math.min(...b.services.map((s) => s.price_min || Infinity));
        return aMin - bMin;
      }
      const scoreA = (a.avg_rating / 5) * 40 + Math.min(a.available_slots / 7, 1) * 30 + Math.min(a.bookings_30d / 10, 1) * 30 + a.ranking_boost * 10;
      const scoreB = (b.avg_rating / 5) * 40 + Math.min(b.available_slots / 7, 1) * 30 + Math.min(b.bookings_30d / 10, 1) * 30 + b.ranking_boost * 10;
      return scoreB - scoreA;
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedVendors = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 460, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Browse Services"
        description="Find and compare verified handyman professionals near you. Filter by category, rating, and price."
        canonical="/browse"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Browse Services",
          description: "Find and compare verified handyman professionals near you.",
          url: "/browse",
        }}
      />
      <UnifiedHeader
        showSearch
        searchValue={filters.search}
        onSearchChange={(val) => updateFilter("search", val)}
        onCategorySelect={(cat) => updateFilter("activeCategory", cat)}
        onSubcategorySelect={(sub) => updateFilter("activeSubcategory", sub)}
      />

      {/* Hero */}
      <BrowseHero
        search={filters.search}
        onSearchChange={(val) => updateFilter("search", val)}
        locationFilter={filters.locationFilter}
        onLocationChange={(val) => updateFilter("locationFilter", val)}
        totalCount={vendors.length}
      />

      {/* Main content area */}
      <main className="pb-16">
        <div className="container-app pt-6">
          {/* Tenant/domain taxonomy visibility check — hidden unless something is missing or ?taxonomy-check=1 */}
          <TaxonomyVisibilityCheck variant="public" className="mb-4" />

          <div className="mb-5">
            <EmergencyToggle
              enabled={emergencyMode}
              onChange={(val) => updateFilter("emergencyMode", val)}
              matchCount={emergencyMode ? filtered.length : undefined}
            />
          </div>

          {/* Mobile filter toggle */}
          <div className="lg:hidden flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              {(["grid", "list", "map"] as const).map((m) => {
                const Icon = m === "grid" ? LayoutGrid : m === "list" ? List : MapIcon;
                return (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    aria-label={`${m} view`}
                    className={cn("p-1.5 rounded-sm transition-all", viewMode === m ? "bg-background text-foreground" : "text-muted-foreground")}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile filter drawer — slides in from the side so it doesn't push results */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetContent
              side="left"
              className="w-[85vw] sm:max-w-sm p-0 flex flex-col lg:hidden"
            >
              <SheetHeader className="px-5 py-4 border-b border-border">
                <SheetTitle className="text-fs-sm font-bold text-heading text-left">
                  Filters
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <BrowseFilterSidebar
                  filters={filters}
                  onFilterChange={updateFilter}
                  categories={categories}
                  subcategories={subcategories}
                  onClearAll={clearAllFilters}
                />
              </div>
              <div className="px-5 py-3 border-t border-border flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  Show results
                </Button>
              </div>
            </SheetContent>
          </Sheet>


          <ActiveFilterChips filters={filters} onFilterChange={updateFilter} />

          <div className="flex gap-6">
            {/* Left sidebar — desktop */}
            <div className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 bg-card border border-border/50 rounded-sm p-4">
                <BrowseFilterSidebar
                  filters={filters}
                  onFilterChange={updateFilter}
                  categories={categories}
                  subcategories={subcategories}
                  onClearAll={clearAllFilters}
                />
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="rounded-sm border border-border overflow-hidden">
                      <div className="h-2 bg-muted animate-pulse" />
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-sm bg-muted animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded-lg w-3/4 animate-pulse" />
                            <div className="h-3 bg-muted rounded-lg w-1/2 animate-pulse" />
                          </div>
                        </div>
                        <div className="h-10 bg-muted rounded-sm animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-5 bg-muted rounded-full w-16 animate-pulse" />
                          <div className="h-5 bg-muted rounded-full w-20 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Featured row — only on All tab, no active search */}
                  {!favoritesOnly && !search && activeCategory === "All" && (
                    <FeaturedProvidersRow vendors={vendors} />
                  )}

                  {/* Tabs: All / Saved */}
                  <div className="flex items-center gap-2 mb-4 border-b border-border">
                    <button
                      onClick={() => { setFavoritesOnly(false); setCurrentPage(1); }}
                      className={cn(
                        "px-3 py-2 text-fs-sm font-semibold transition-colors border-b-2 -mb-px",
                        !favoritesOnly ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All Pros
                    </button>
                    <button
                      onClick={() => { setFavoritesOnly(true); setCurrentPage(1); }}
                      className={cn(
                        "px-3 py-2 text-fs-sm font-semibold transition-colors border-b-2 -mb-px inline-flex items-center gap-1.5",
                        favoritesOnly ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Heart className={cn("w-3.5 h-3.5", favoritesOnly && "fill-current text-primary")} />
                      Saved
                    </button>
                  </div>

                  {/* Results header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <p className="text-fs-sm text-muted-foreground tabular-nums">
                      <span className="font-semibold text-heading">{filtered.length}</span> professional{filtered.length !== 1 ? "s" : ""} found
                      {totalPages > 1 && (
                        <span className="ml-1.5 text-muted-foreground/60">
                          · page {currentPage} of {totalPages}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={filters.sortBy}
                        onValueChange={(v) => updateFilter("sortBy", v as BrowseFilters["sortBy"])}
                      >
                        <SelectTrigger className="h-9 w-[160px] text-fs-sm">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="relevance">Best match</SelectItem>
                          <SelectItem value="rating">Top rated</SelectItem>
                          <SelectItem value="reviews">Most reviewed</SelectItem>
                          <SelectItem value="booked">Most booked</SelectItem>
                          <SelectItem value="price">Price: low to high</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="hidden lg:flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                        {(["grid", "list", "map"] as const).map((m) => {
                          const Icon = m === "grid" ? LayoutGrid : m === "list" ? List : MapIcon;
                          return (
                            <button
                              key={m}
                              onClick={() => setViewMode(m)}
                              className={cn(
                                "p-1.5 rounded-sm transition-all duration-200 active:scale-95",
                                viewMode === m ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                              )}
                              aria-label={`${m} view`}
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="text-center py-24 animate-reveal">
                      <div className="w-16 h-16 rounded-sm bg-muted/80 flex items-center justify-center mx-auto mb-5">
                        {favoritesOnly ? (
                          <Heart className="w-7 h-7 text-muted-foreground/50" />
                        ) : (
                          <Search className="w-7 h-7 text-muted-foreground/50" />
                        )}
                      </div>
                      <p className="text-heading font-semibold text-fs-lg mb-1">
                        {favoritesOnly ? "No saved pros yet" : "No professionals found"}
                      </p>
                      <p className="text-fs-sm text-muted-foreground max-w-sm mx-auto">
                        {favoritesOnly
                          ? "Tap the heart on any pro to save them for quick access later."
                          : "Try adjusting your search, location, or category filters."}
                      </p>
                      {!favoritesOnly && (
                        <Button variant="outline" className="mt-5" onClick={clearAllFilters}>Clear all filters</Button>
                      )}
                      {favoritesOnly && (
                        <Button variant="outline" className="mt-5" onClick={() => setFavoritesOnly(false)}>Browse all pros</Button>
                      )}
                    </div>
                  ) : viewMode === "map" ? (
                    <ProviderMapView vendors={filtered} />
                  ) : (
                    <>
                      <div className={cn(viewMode === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-6" : "flex flex-col gap-3")}>
                        {paginatedVendors.map((v, i) =>
                          viewMode === "list" ? (
                            <ProviderListCard key={v.vendor_id} vendor={v} index={i} isFavorite={isFavorite(v.vendor_id)} onToggleFavorite={toggleFavorite} nearestSlot={nearestSlots.get(v.vendor_id)} />
                          ) : (
                            <ProviderGridCard key={v.vendor_id} vendor={v} index={i} isFavorite={isFavorite(v.vendor_id)} onToggleFavorite={toggleFavorite} nearestSlot={nearestSlots.get(v.vendor_id)} />
                          )
                        )}
                      </div>

                      <BrowsePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BrowseServices;
