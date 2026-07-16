import { useEffect, useState, useMemo } from"react";
import { useParams, useNavigate, Link } from"react-router-dom";
import SEOHead from"@/components/SEOHead";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import Footer from"@/components/landing/Footer";
import { supabase } from"@/integrations/supabase/client";
import { useFavorites } from"@/hooks/useFavorites";
import { getCategoryIcon } from"@/lib/categoryIcons";
import ProviderGridCard from"@/components/browse/ProviderGridCard";
import type { ProviderCardData } from"@/components/browse/types";
import PageHeroBanner from"@/components/PageHeroBanner";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import {
 Droplet, Zap, Sparkles, PaintBucket, Hammer, Truck, Wrench, Wind,
 Snowflake, Package, ArrowRight, Search, ChevronRight, Users, Briefcase,
} from"lucide-react";
import { Heading } from "@/components/ui/app";
import { withSubcategoryOverrides } from "@/lib/subcategoryOverrides";
import CategoryEmptyState from "@/components/browse/CategoryEmptyState";

const ICON_MAP: Record<string, { icon: typeof Droplet; color: string; bg: string; gradient: string }> = {
 Droplet: { icon: Droplet, color:"text-blue-500", bg:"bg-blue-500/10", gradient:"from-blue-600/20 via-blue-500/5 to-transparent" },
 Zap: { icon: Zap, color:"text-amber-500", bg:"bg-amber-500/10", gradient:"from-amber-600/20 via-amber-500/5 to-transparent" },
 Sparkles: { icon: Sparkles, color:"text-teal-500", bg:"bg-teal-500/10", gradient:"from-teal-600/20 via-teal-500/5 to-transparent" },
 PaintBucket: { icon: PaintBucket, color:"text-rose-500", bg:"bg-rose-500/10", gradient:"from-rose-600/20 via-rose-500/5 to-transparent" },
 Hammer: { icon: Hammer, color:"text-orange-500", bg:"bg-orange-500/10", gradient:"from-orange-600/20 via-orange-500/5 to-transparent" },
 Truck: { icon: Truck, color:"text-indigo-500", bg:"bg-indigo-500/10", gradient:"from-indigo-600/20 via-indigo-500/5 to-transparent" },
 Wrench: { icon: Wrench, color:"text-slate-500", bg:"bg-slate-500/10", gradient:"from-slate-600/20 via-slate-500/5 to-transparent" },
 Wind: { icon: Wind, color:"text-cyan-500", bg:"bg-cyan-500/10", gradient:"from-cyan-600/20 via-cyan-500/5 to-transparent" },
 Snowflake: { icon: Snowflake, color:"text-sky-500", bg:"bg-sky-500/10", gradient:"from-sky-600/20 via-sky-500/5 to-transparent" },
};

const DEFAULT_ICON = { icon: Package, color:"text-primary", bg:"bg-primary/10", gradient:"from-primary/20 via-primary/5 to-transparent" };

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
"Plumbing":"From leaky faucets to full pipe replacements — find licensed plumbers ready to solve your water woes.",
"Electrical":"Certified electricians for wiring, panel upgrades, lighting installations, and safety inspections.",
"Cleaning":"Professional cleaners for deep cleans, recurring housekeeping, move-in/out, and commercial spaces.",
"Painting":"Interior and exterior painters for accent walls, full repaints, staining, and decorative finishes.",
"Carpentry":"Skilled carpenters for custom furniture, framing, trim work, decking, and structural repairs.",
"Moving":"Reliable movers for local & long-distance relocations, packing services, and heavy item transport.",
"Appliance Repair":"Expert technicians for washer, dryer, fridge, dishwasher, oven, and other appliance repairs.",
"AC Service":"HVAC specialists for AC installation, repair, maintenance, and duct cleaning.",
};

interface SubCategory {
 id: string;
 name: string;
 slug: string;
 category_id: string;
 icon: string | null;
 sort_order?: number | null;
}

function slugify(text: string) {
 return text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}

export default function CategoryPage() {
 const { slug } = useParams<{ slug: string }>();
 const navigate = useNavigate();
 const { toggleFavorite, isFavorite } = useFavorites();

 const [category, setCategory] = useState<{ id: string; name: string; icon: string | null } | null>(null);
 const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
 const [vendors, setVendors] = useState<ProviderCardData[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeSub, setActiveSub] = useState("All");
 const [searchQuery, setSearchQuery] = useState("");
 const [notFound, setNotFound] = useState(false);

 useEffect(() => {
 if (!slug) return;
 fetchCategoryData();
 }, [slug]);

 const fetchCategoryData = async () => {
 setLoading(true);
 // Fetch all categories to find by slug match
 const { data: cats } = await supabase.from("service_categories").select("id, name, icon");
 const matched = (cats || []).find((c) => slugify(c.name) === slug);

 if (!matched) {
 setNotFound(true);
 setLoading(false);
 return;
 }
 setCategory(matched);

 const todayDow = new Date().getDay();
 const next7Days = Array.from({ length: 7 }, (_, i) => (todayDow + i) % 7);
 const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

 const [subsRes, servicesRes, reviewsRes, profilesRes, availRes, bookingsRes] = await Promise.all([
 supabase.from("service_subcategories").select("id, name, slug, category_id, icon, sort_order").eq("category_id", matched.id).order("sort_order").order("name"),
 supabase.from("vendor_services").select("id, vendor_id, title, price_min, price_type, category_id, subcategory_id, is_active, is_sponsored, sponsored_until, category:service_categories(name)").eq("is_active", true).eq("category_id", matched.id),
 supabase.from("reviews").select("vendor_id, rating"),
 supabase.from("profiles").select("user_id, display_name, address, bio, avatar_url, is_featured, featured_until, featured_rank"),
 supabase.from("vendor_availability").select("vendor_id, day_of_week").eq("is_available", true).in("day_of_week", next7Days),
 supabase.from("bookings").select("vendor_id").gte("created_at", thirtyDaysAgo),
 ]);

 const subs = await withSubcategoryOverrides((subsRes.data || []) as SubCategory[]);
 const services = servicesRes.data || [];
 const reviews = reviewsRes.data || [];
 const profiles = profilesRes.data || [];
 const avail = availRes.data || [];
 const bookings = bookingsRes.data || [];

 setSubcategories(subs);

 const vendorPlanMap: Record<string, { plan_name: string; ranking_boost: number }> = {};

 const ratingMap: Record<string, { total: number; count: number }> = {};
 reviews.forEach((r) => { if (!ratingMap[r.vendor_id]) ratingMap[r.vendor_id] = { total: 0, count: 0 }; ratingMap[r.vendor_id].total += r.rating; ratingMap[r.vendor_id].count += 1; });

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
 display_name: p?.display_name ||"Provider",
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
 };
  if (p?.is_featured && (!p?.featured_until || new Date(p.featured_until) > new Date())) {
    (vendorMap[s.vendor_id] as any).is_featured = true;
    vendorMap[s.vendor_id].ranking_boost = (vendorMap[s.vendor_id].ranking_boost || 0) + 2000;
  }
 }
  if (s.is_sponsored && s.sponsored_until && new Date(s.sponsored_until) > new Date()) {
    (vendorMap[s.vendor_id] as any).is_sponsored = true;
    const prev = vendorMap[s.vendor_id].sponsored_until;
    if (!prev || new Date(s.sponsored_until) > new Date(prev)) {
      vendorMap[s.vendor_id].sponsored_until = s.sponsored_until;
    }
    vendorMap[s.vendor_id].ranking_boost = (vendorMap[s.vendor_id].ranking_boost || 0) + 1000;
  }
 const catName = s.category?.name ||"Other";
 const subName = s.subcategory_id ? (subs.find((sc) => sc.id === s.subcategory_id)?.name || null) : null;
 vendorMap[s.vendor_id].services.push({
 id: s.id, title: s.title, price_min: s.price_min,
 price_type: s.price_type, category_name: catName,
 subcategory_id: s.subcategory_id || null,
 subcategory_name: subName,
 });
 if (!vendorMap[s.vendor_id].categories.includes(catName)) vendorMap[s.vendor_id].categories.push(catName);
 });

 setVendors(Object.values(vendorMap));
 setLoading(false);
 };

 const filteredVendors = useMemo(() => {
 let result = vendors;
 if (activeSub !=="All") {
 const subId = subcategories.find((s) => s.name === activeSub)?.id;
 if (subId) result = result.filter((v) => v.services.some((s) => s.subcategory_id === subId));
 }
 if (searchQuery.trim()) {
 const q = searchQuery.trim().toLowerCase();
 result = result.filter((v) =>
 v.display_name.toLowerCase().includes(q) ||
 v.services.some((s) => s.title.toLowerCase().includes(q)) ||
 (v.address && v.address.toLowerCase().includes(q))
 );
 }
 return result;
  }, [vendors, activeSub, subcategories, searchQuery]);

  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => {
      const aF = (a as any).is_featured ? 1 : 0;
      const bF = (b as any).is_featured ? 1 : 0;
      if (aF !== bF) return bF - aF;
      const aS = (a as any).is_sponsored ? 1 : 0;
      const bS = (b as any).is_sponsored ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return (b.ranking_boost || 0) - (a.ranking_boost || 0);
    });
  }, [filteredVendors]);

 const iconData = ICON_MAP[category?.icon ||""] || DEFAULT_ICON;
 const Icon = iconData.icon;
 const description = category ? (CATEGORY_DESCRIPTIONS[category.name] ||`Find trusted ${category.name} professionals near you.`) :"";
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(sortedVendors, 12);

 if (notFound) {
 return (
 <div className="min-h-screen bg-background">
 <UnifiedHeader />
 <div className="container-app py-32 text-center">
 <div className="w-16 h-16 rounded-sm bg-muted/80 flex items-center justify-center mx-auto mb-5">
 <Search className="w-7 h-7 text-muted-foreground/50" />
 </div>
 <Heading level={1}  className="mb-2">Category not found</Heading>
 <p className="text-muted-foreground mb-6">The category you're looking for doesn't exist.</p>
 <Button onClick={() => navigate("/browse")}>Browse All Services</Button>
 </div>
 <Footer />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 <SEOHead
 title={category ?`${category.name} Services` :"Category"}
 description={description}
 canonical={category ?`/category/${slug ??""}` : undefined}
 jsonLd={category ? {
 "@context":"https://schema.org",
 "@type":"BreadcrumbList",
 itemListElement: [
   { "@type":"ListItem", position: 1, name:"Home", item:"/" },
   { "@type":"ListItem", position: 2, name:"Browse", item:"/browse" },
   { "@type":"ListItem", position: 3, name: category.name, item:`/category/${slug ??""}` },
 ],
 } : undefined}
 />
 <UnifiedHeader />

 <PageHeroBanner
 icon={Icon}
 iconColor={iconData.color}
 iconBg={iconData.bg}
 gradient={iconData.gradient}
 title={category?.name ||"Loading…"}
 description={description}
 breadcrumbs={[
 { label:"Home", to:"/" },
 { label:"Browse", to:"/browse" },
 { label: category?.name ||"…" },
 ]}
 stats={[
 { icon: Users, value: vendors.length, label:`professional${vendors.length !== 1 ?"s" :""}` },
 { icon: Briefcase, value: subcategories.length, label:`specialization${subcategories.length !== 1 ?"s" :""}` },
 ]}
 >
 {/* Search bar */}
 <div className="relative mt-6 max-w-md">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder={`Search ${category?.name ||""} professionals...`}
 className="w-full pl-10 pr-4 py-2.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/30 text-fs-sm text-foreground placeholder:text-muted-foreground transition-all"
 />
 </div>
 </PageHeroBanner>

 <main className="pb-20">
 <div className="container-app pt-8">
 {/* Subcategory filter pills */}
 {subcategories.length > 0 && (
 <div className="flex flex-wrap gap-2 mb-8">
 <button
 onClick={() => setActiveSub("All")}
 className={`px-4 py-2 rounded-full text-fs-sm font-medium transition-all duration-200 ${
 activeSub ==="All"
 ?"bg-primary text-primary-foreground"
 :"bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
 }`}
 >
 All
 </button>
 {subcategories.map((sub) => {
 const SubIcon = getCategoryIcon(sub.icon);
 return (
 <button
 key={sub.id}
 onClick={() => setActiveSub(sub.name)}
 className={`px-4 py-2 rounded-full text-fs-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
 activeSub === sub.name
 ?"bg-primary text-primary-foreground"
 :"bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
 }`}
 >
 <SubIcon className="w-3.5 h-3.5" />
 {sub.name}
 </button>
 );
 })}
 </div>
 )}

 {loading ? (
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
 </div>
 </div>
 ))}
 </div>
 ) : filteredVendors.length === 0 ? (
 <CategoryEmptyState
   categoryName={category?.name}
   categorySlug={slug}
   activeSubcategory={activeSub}
  />
 ) : (
 <>

 <p className="text-fs-sm text-muted-foreground mb-5">
 <span className="font-semibold text-heading">{filteredVendors.length}</span> professional{filteredVendors.length !== 1 ?"s" :""}{activeSub !=="All" ?` in ${activeSub}` :""}
 </p>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
 {pageItems.map((v, i) => (
 <ProviderGridCard
 key={v.vendor_id}
 vendor={v}
 index={i}
 isFavorite={isFavorite(v.vendor_id)}
 onToggleFavorite={toggleFavorite}
 />
 ))}
 </div>
 <NumberedPagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 pageSize={pageSize}
 onPageChange={setPage}
 onPageSizeChange={setPageSize}
 />
 </>
 )}
 </div>
 </main>
 <Footer />
 </div>
 );
}
