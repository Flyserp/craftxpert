import { useState, useEffect } from"react";
import { useSearchParams, useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/contexts/AuthContext";
import { createNotification } from"@/lib/notifications";
import { toast } from"sonner";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import PageHeroBanner from"@/components/PageHeroBanner";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Badge } from"@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { cn } from"@/lib/utils";
import {
 Sparkles, Star, Clock, MapPin, TrendingUp, ChevronRight, Loader2,
 CheckCircle2, Zap, DollarSign, Target, Shield, Gauge, ArrowLeft,
 Search, SlidersHorizontal, Award, Crown, Info, Send, Check, Share2,
} from"lucide-react";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";

/* ─── Types ─── */
interface MatchDimensions {
 skill_match: number;
 rating: number;
 distance: number;
 availability: number;
 budget_fit: number;
 response_speed: number;
}

interface MatchedVendor {
 vendor_id: string;
 display_name: string;
 address: string | null;
 bio: string | null;
 avatar_url: string | null;
 avg_rating: number;
 review_count: number;
 available_slots: number;
 bookings_30d: number;
 completion_rate: number;
 response_rate: number;
 score: number;
 dimensions: MatchDimensions;
 services: { id: string; vendor_id: string; title: string; price_min: number | null; price_max: number | null; price_type: string }[];
}

interface Category { id: string; name: string; }

const DIMENSION_CONFIG: { key: keyof MatchDimensions; label: string; icon: typeof Star; color: string }[] = [
 { key:"skill_match", label:"Skill Match", icon: Target, color:"text-violet-500" },
 { key:"rating", label:"Ratings", icon: Star, color:"text-amber-500" },
 { key:"distance", label:"Distance", icon: MapPin, color:"text-blue-500" },
 { key:"availability", label:"Availability", icon: Clock, color:"text-emerald-500" },
 { key:"budget_fit", label:"Budget Fit", icon: DollarSign, color:"text-green-500" },
 { key:"response_speed", label:"Response Speed", icon: Gauge, color:"text-orange-500" },
];

type SortKey ="score" |"distance" |"rating" |"availability";
const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Star }[] = [
 { key:"score", label:"Best match", icon: SlidersHorizontal },
 { key:"distance", label:"Distance", icon: MapPin },
 { key:"rating", label:"Rating", icon: Star },
 { key:"availability", label:"Availability", icon: Clock },
];

function buildMatchReasons(v: MatchedVendor): string[] {
 const reasons: string[] = [];
 const d = v.dimensions;

 if (d.skill_match >= 70) reasons.push(`Strong skill match — ${v.review_count} review${v.review_count === 1 ?"" :"s"} in this category.`);
 else if (d.skill_match >= 40) reasons.push(`Decent skill match based on past work.`);

 if (v.avg_rating >= 4.5 && v.review_count >= 3) reasons.push(`Highly rated: ${v.avg_rating}★ across ${v.review_count} reviews.`);
 else if (v.avg_rating >= 4 && v.review_count > 0) reasons.push(`Solid rating: ${v.avg_rating}★ from ${v.review_count} review${v.review_count === 1 ?"" :"s"}.`);

 if (d.distance >= 60) reasons.push(`Located near your address.`);
 else if (d.distance >= 30) reasons.push(`Roughly in your area.`);

 if (v.available_slots >= 10) reasons.push(`Lots of openings — ${v.available_slots} time slots this week.`);
 else if (v.available_slots > 0) reasons.push(`${v.available_slots} time slot${v.available_slots === 1 ?"" :"s"} open this week.`);

 if (d.budget_fit >= 70) reasons.push(`Pricing fits your budget well.`);
 else if (d.budget_fit >= 40) reasons.push(`Pricing partially overlaps your budget.`);

 if (v.response_rate >= 70) reasons.push(`Fast responder — accepts ${v.response_rate}% of requests.`);
 if (v.completion_rate >= 80) reasons.push(`Reliable: ${v.completion_rate}% job completion rate.`);
 if (v.bookings_30d >= 5) reasons.push(`In demand — ${v.bookings_30d} bookings in the last 30 days.`);

 if (reasons.length === 0) reasons.push("Limited recent activity, but available for new work.");
 return reasons.slice(0, 5);
}

function ScoreBadge({ score, vendor }: { score: number; vendor?: MatchedVendor }) {
 const tier = score >= 80 ?"excellent" : score >= 60 ?"great" : score >= 40 ?"good" :"fair";
 const styles = {
 excellent:"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
 great:"bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
 good:"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
 fair:"bg-muted text-muted-foreground border-border/40",
 };
 const badge = (
 <span
 className={cn(
"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums",
 styles[tier],
 vendor &&"cursor-help hover:brightness-110 transition"
 )}
 >
 {score}%
 {vendor && <Info className="w-2.5 h-2.5 opacity-70" />}
 </span>
 );

 if (!vendor) return badge;
 const reasons = buildMatchReasons(vendor);
 return (
 <Popover>
 <PopoverTrigger
 asChild
 onClick={(e) => e.stopPropagation()}
 >
 {badge}
 </PopoverTrigger>
 <PopoverContent
 align="start"
 side="bottom"
 className="w-72 p-3"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-1.5 mb-2">
 <Sparkles className="w-3.5 h-3.5 text-primary" />
 <p className="text-fs-xs font-bold uppercase tracking-wider text-primary">Why this match</p>
 </div>
 <ul className="space-y-1.5">
 {reasons.map((r, i) => (
 <li key={i} className="flex items-start gap-1.5 text-fs-xs text-body leading-snug">
 <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
 <span>{r}</span>
 </li>
 ))}
 </ul>
 </PopoverContent>
 </Popover>
 );
}

function DimensionBar({ value, color }: { value: number; color: string }) {
 return (
 <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
 <div
 className={cn("h-full rounded-full transition-all duration-700", color.replace("text-","bg-"))}
 style={{ width:`${value}%` }}
 />
 </div>
 );
}

function MatchRank({ rank }: { rank: number }) {
 if (rank === 1) return <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-500" /></div>;
 if (rank === 2) return <div className="w-8 h-8 rounded-full bg-slate-400/15 flex items-center justify-center"><Award className="w-4 h-4 text-slate-400" /></div>;
 if (rank === 3) return <div className="w-8 h-8 rounded-full bg-orange-400/15 flex items-center justify-center"><Award className="w-4 h-4 text-orange-400" /></div>;
 return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-fs-xs font-bold text-muted-foreground">#{rank}</div>;
}

type FilterKey ="top_rated" |"available" |"in_budget" |"fast_responder";

const FILTER_CHIPS: { key: FilterKey; label: string; icon: typeof Star }[] = [
 { key:"top_rated", label:"Top rated", icon: Star },
 { key:"available", label:"Available this week", icon: Clock },
 { key:"in_budget", label:"In my budget", icon: DollarSign },
 { key:"fast_responder", label:"Fast responder", icon: Gauge },
];

function applyFilters(vendors: MatchedVendor[], filters: Set<FilterKey>): MatchedVendor[] {
 if (filters.size === 0) return vendors;
 return vendors.filter((v) => {
 if (filters.has("top_rated") && !(v.avg_rating >= 4.5 && v.review_count >= 3)) return false;
 if (filters.has("available") && !(v.available_slots > 0)) return false;
 if (filters.has("in_budget") && !(v.dimensions.budget_fit >= 60)) return false;
 if (filters.has("fast_responder") && !(v.response_rate >= 70 || v.dimensions.response_speed >= 70)) return false;
 return true;
 });
}

const AIMatchPage = () => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();

 const [categories, setCategories] = useState<Category[]>([]);
 const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") ||"");
 const [customerAddress, setCustomerAddress] = useState(searchParams.get("address") ||"");
 const [budgetMin, setBudgetMin] = useState(searchParams.get("budgetMin") ||"");
 const [budgetMax, setBudgetMax] = useState(searchParams.get("budgetMax") ||"");
 const taskId = searchParams.get("taskId") ||"";

 const [loading, setLoading] = useState(false);
 const [recommendation, setRecommendation] = useState("");
 const [vendors, setVendors] = useState<MatchedVendor[]>([]);
 const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
 const [hasSearched, setHasSearched] = useState(false);
 const [taskTitle, setTaskTitle] = useState<string>("");
 const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
 const [invitingId, setInvitingId] = useState<string | null>(null);
 const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(() => {
 const raw = searchParams.get("filters");
 if (!raw) return new Set();
 const valid = new Set(FILTER_CHIPS.map((c) => c.key));
 return new Set(raw.split(",").filter((k): k is FilterKey => valid.has(k as FilterKey)));
 });
 const [sortBy, setSortBy] = useState<SortKey>(() => {
 const raw = searchParams.get("sort");
 return SORT_OPTIONS.some((o) => o.key === raw) ? (raw as SortKey) :"score";
 });

 // Persist sort + filters to URL (preserve other params like taskId, category, etc.)
 useEffect(() => {
 setSearchParams(
 (prev) => {
 const next = new URLSearchParams(prev);
 if (sortBy !=="score") next.set("sort", sortBy);
 else next.delete("sort");
 if (activeFilters.size > 0) next.set("filters", Array.from(activeFilters).join(","));
 else next.delete("filters");
 return next;
 },
 { replace: true }
 );
 }, [sortBy, activeFilters, setSearchParams]);

 useEffect(() => {
 supabase.from("service_categories").select("id, name").order("name").then(({ data }) => {
 if (data) setCategories(data);
 });
 }, []);

 // If a taskId is provided, load the task title + any existing invitations from this client
 useEffect(() => {
 if (!taskId || !user) return;
 (async () => {
 const [{ data: task }, { data: existing }] = await Promise.all([
 supabase.from("tasks").select("title").eq("id", taskId).maybeSingle(),
 supabase
 .from("task_proposals")
 .select("vendor_id")
 .eq("task_id", taskId)
 .eq("customer_id", user.id),
 ]);
 if (task?.title) setTaskTitle(task.title);
 if (existing) setInvitedIds(new Set(existing.map((e: any) => e.vendor_id)));
 })();
 }, [taskId, user]);

 // Auto-search if category is provided via URL
 useEffect(() => {
 if (selectedCategory && !hasSearched) {
 handleSearch();
 }
 }, [selectedCategory, categories]);

 const handleInvite = async (vendor: MatchedVendor) => {
 if (!user || !taskId) return;
 if (invitedIds.has(vendor.vendor_id)) return;
 setInvitingId(vendor.vendor_id);
 try {
 const { error } = await supabase.from("task_proposals").insert({
 task_id: taskId,
 customer_id: user.id,
 vendor_id: vendor.vendor_id,
 direction:"customer_invited",
 status:"pending",
 message:`You've been invited to quote on"${taskTitle ||"a task"}".`,
 } as any);
 if (error) throw error;

 setInvitedIds((prev) => new Set(prev).add(vendor.vendor_id));
 toast.success(`${vendor.display_name} invited to your task`);

 await createNotification({
 userId: vendor.vendor_id,
 type:"task_invitation",
 title:"You've been invited to a task",
 message:`A client invited you to quote on"${taskTitle ||"their task"}".`,
 metadata: { task_id: taskId, customer_id: user.id },
 });
 } catch (e: any) {
 console.error("Invite error:", e);
 toast.error(e?.message ||"Failed to send invitation");
 } finally {
 setInvitingId(null);
 }
 };

 const handleSearch = async () => {
 if (!selectedCategory) return;
 setLoading(true);
 setHasSearched(true);
 setExpandedVendor(null);

 try {
 const { data, error } = await supabase.functions.invoke("smart-match-vendor", {
 body: {
 categoryId: selectedCategory,
 customerAddress: customerAddress || undefined,
 budgetMin: budgetMin ? Number(budgetMin) : undefined,
 budgetMax: budgetMax ? Number(budgetMax) : undefined,
 },
 });
 if (error) throw error;
 const vendorList = data?.vendors || [];
 setRecommendation(data?.recommendation ||"");
 setVendors(vendorList);

 // Persist to recent_matches (fire-and-forget)
 if (user && selectedCategory) {
 const catName = categories.find((c) => c.id === selectedCategory)?.name || null;
 supabase.from("recent_matches").insert({
 user_id: user.id,
 category_id: selectedCategory,
 category_name: catName,
 address: customerAddress || null,
 budget_min: budgetMin ? Number(budgetMin) : null,
 budget_max: budgetMax ? Number(budgetMax) : null,
 task_id: taskId || null,
 result_count: vendorList.length,
 top_vendor_name: vendorList[0]?.display_name || null,
 } as any).then(({ error: insErr }) => {
 if (insErr) console.warn("recent_matches insert failed:", insErr.message);
 });
 }
 } catch (e) {
 console.error("Match error:", e);
 } finally {
 setLoading(false);
 }
 };

 const categoryName = categories.find((c) => c.id === selectedCategory)?.name ||"";
 const filteredVendors = (() => {
 const list = applyFilters(vendors, activeFilters);
 if (sortBy ==="distance") return [...list].sort((a, b) => b.dimensions.distance - a.dimensions.distance);
 if (sortBy ==="rating") {
 return [...list].sort(
 (a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count
 );
 }
 if (sortBy ==="availability") {
 return [...list].sort(
 (a, b) => b.dimensions.availability - a.dimensions.availability || b.available_slots - a.available_slots
 );
 }
 return list;
 })();
 const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filteredVendors, 10);

 return (
 <div className="min-h-screen bg-background">
 <UnifiedHeader />
 <PageHeroBanner
 icon={Sparkles}
 iconColor="text-violet-500"
 iconBg="bg-violet-500/10"
 gradient="from-violet-600/20 via-violet-500/5 to-transparent"
 title="AI Smart Match"
 description="Find the perfect professional ranked by 6 intelligent signals."
 breadcrumbs={[
 { label:"Home", to:"/" },
 { label:"AI Match" },
 ]}
 />
 <main className="pb-16">
 <div className="container-app max-w-3xl pt-8">

 {/* Inviting-for banner */}
 {taskId && (
 <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.04] px-3.5 py-2.5 animate-reveal">
 <div className="w-7 h-7 rounded-sm bg-primary/15 flex items-center justify-center shrink-0">
 <Send className="w-3.5 h-3.5 text-primary" />
 </div>
 <p className="text-fs-xs sm:text-fs-sm text-body min-w-0">
 <span className="font-semibold text-heading">Inviting for:</span>{""}
 <span className="truncate">{taskTitle ||"your task"}</span>
 </p>
 </div>
 )}

 {/* Search Form */}
 <div className="bg-card rounded-sm border border-border p-5 mb-6 animate-reveal-delay-1">
 <div className="grid sm:grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1.5">Service Category</label>
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-fs-sm"
 >
 <option value="">Select a category…</option>
 {categories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="flex items-center gap-1 text-fs-xs font-medium text-heading mb-1.5">
 <MapPin className="w-3 h-3 text-muted-foreground" /> Your Location <span className="text-muted-foreground font-normal">(optional)</span>
 </label>
 <Input
 value={customerAddress}
 onChange={(e) => setCustomerAddress(e.target.value)}
 placeholder="e.g. 123 Main St, Austin TX"
 className="text-fs-sm"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1.5">Budget Min ($)</label>
 <Input type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="0" />
 </div>
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1.5">Budget Max ($)</label>
 <Input type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="No limit" />
 </div>
 </div>
 <Button onClick={handleSearch} disabled={!selectedCategory || loading} className="w-full gap-2">
 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
 {loading ?"Matching…" :"Find Best Matches"}
 </Button>
 </div>

 {/* Loading */}
 {loading && (
 <div className="space-y-4 animate-pulse">
 <div className="bg-card rounded-sm border p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
 <Sparkles className="w-5 h-5 text-primary animate-pulse" />
 </div>
 <div>
 <div className="h-4 bg-muted rounded w-40 mb-1" />
 <div className="h-3 bg-muted rounded w-56" />
 </div>
 </div>
 <div className="h-4 bg-muted rounded w-4/5 mb-2" />
 <div className="h-4 bg-muted rounded w-3/5" />
 </div>
 {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-card rounded-sm border animate-pulse" />)}
 </div>
 )}

 {/* Results */}
 {!loading && hasSearched && (
 <div className="space-y-4 animate-reveal">
 {/* AI Recommendation */}
 {recommendation && (
 <div className="relative overflow-hidden rounded-sm border border-primary/20 bg-primary/[0.03] p-5">
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 rounded-sm bg-primary/15 flex items-center justify-center shrink-0">
 <Sparkles className="w-4 h-4 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-fs-xs font-bold uppercase tracking-wider text-primary mb-1.5">AI Recommendation</p>
 <p className="text-fs-sm text-body leading-relaxed">{recommendation}</p>
 </div>
 </div>
 </div>
 )}

 {/* Match count + filter chips */}
 {vendors.length > 0 && (
 <>
 <div className="flex items-center justify-between">
 <p className="text-fs-sm font-medium text-heading">
 {filteredVendors.length} of {vendors.length} professional{vendors.length !== 1 ?"s" :""} matched
 {categoryName && <span className="text-muted-foreground"> for {categoryName}</span>}
 </p>
 <div className="flex items-center gap-2">
 <button
 onClick={async () => {
 try {
 await navigator.clipboard.writeText(window.location.href);
 toast.success("Share link copied to clipboard");
 } catch {
 toast.error("Couldn't copy link");
 }
 }}
 className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-border/60 bg-card text-muted-foreground hover:text-heading transition"
 title="Copy share link"
 >
 <Share2 className="w-3 h-3" /> Copy share link
 </button>
 <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card p-0.5 flex-wrap">
 {SORT_OPTIONS.map((opt) => {
 const Icon = opt.icon;
 const active = sortBy === opt.key;
 return (
 <button
 key={opt.key}
 onClick={() => setSortBy(opt.key)}
 className={cn(
"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition",
 active
 ?"bg-primary text-primary-foreground"
 :"text-muted-foreground hover:text-heading"
 )}
 >
 <Icon className="w-3 h-3" /> {opt.label}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div className="flex flex-wrap gap-2">
 {FILTER_CHIPS.map((chip) => {
 const active = activeFilters.has(chip.key);
 const Icon = chip.icon;
 return (
 <button
 key={chip.key}
 onClick={() => {
 setActiveFilters((prev) => {
 const next = new Set(prev);
 if (next.has(chip.key)) next.delete(chip.key);
 else next.add(chip.key);
 return next;
 });
 }}
 className={cn(
"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-xs font-medium border transition-all active:scale-95",
 active
 ?"bg-primary text-primary-foreground border-primary"
 :"bg-card text-body border-border/60 hover:border-primary/40"
 )}
 >
 <Icon className="w-3 h-3" />
 {chip.label}
 {active && <Check className="w-3 h-3" />}
 </button>
 );
 })}
 {activeFilters.size > 0 && (
 <button
 onClick={() => setActiveFilters(new Set())}
 className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-fs-xs font-medium text-muted-foreground hover:text-heading transition"
 >
 Clear all
 </button>
 )}
 </div>
 </>
 )}

 {vendors.length === 0 && (
 <div className="text-center py-16">
 <div className="w-14 h-14 rounded-sm bg-muted flex items-center justify-center mx-auto mb-3">
 <Search className="w-6 h-6 text-muted-foreground" />
 </div>
 <p className="text-fs-sm font-medium text-heading mb-1">No professionals found</p>
 <p className="text-fs-xs text-muted-foreground">Try a different category or broaden your budget range.</p>
 </div>
 )}

 {vendors.length > 0 && filteredVendors.length === 0 && (
 <div className="text-center py-12 rounded-sm border border-dashed border-border/60">
 <p className="text-fs-sm font-medium text-heading mb-1">No matches with these filters</p>
 <p className="text-fs-xs text-muted-foreground mb-3">Try removing one of the filters above.</p>
 <Button size="sm" variant="outline" onClick={() => setActiveFilters(new Set())}>
 Clear filters
 </Button>
 </div>
 )}

 {/* Vendor cards */}
 {pageItems.map((v, idx) => {
 const rank = (page - 1) * 10 + idx + 1;
 const isExpanded = expandedVendor === v.vendor_id;
 const topBadges = DIMENSION_CONFIG.filter((d) => v.dimensions[d.key] >= 60).slice(0, 3);

 return (
 <div
 key={v.vendor_id}
 className={cn(
"rounded-sm border transition-all duration-300",
 rank === 1 ?"border-primary/30 bg-card" :"border-border/60 bg-card"
 )}
 >
 {/* Main card */}
 <button
 onClick={() => setExpandedVendor(isExpanded ? null : v.vendor_id)}
 className="w-full text-left p-5"
 >
 <div className="flex items-start gap-3">
 <MatchRank rank={rank} />

 {/* Avatar */}
 <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center text-fs-sm font-bold text-primary shrink-0 overflow-hidden">
 {v.avatar_url ? (
 <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
 ) : (
 (v.display_name ||"V").slice(0, 2).toUpperCase()
 )}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <p className="text-fs-sm font-semibold text-heading truncate">{v.display_name}</p>
 <ScoreBadge score={v.score} vendor={v} />
 </div>

 {/* Stats row */}
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fs-xs text-muted-foreground mb-2">
 {v.avg_rating > 0 && (
 <span className="flex items-center gap-0.5">
 <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
 <span className="font-semibold text-heading tabular-nums">{v.avg_rating}</span>
 <span>({v.review_count})</span>
 </span>
 )}
 {v.available_slots > 0 && (
 <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
 <Clock className="w-3 h-3" /> {v.available_slots} slots
 </span>
 )}
 {v.completion_rate > 0 && (
 <span className="flex items-center gap-0.5">
 <CheckCircle2 className="w-3 h-3 text-primary" /> {v.completion_rate}%
 </span>
 )}
 {v.bookings_30d > 0 && (
 <span className="flex items-center gap-0.5">
 <TrendingUp className="w-3 h-3" /> {v.bookings_30d} recent
 </span>
 )}
 </div>

 {/* Top dimension badges */}
 <div className="flex flex-wrap gap-1.5">
 {topBadges.map((d) => (
 <span
 key={d.key}
 className={cn(
"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground"
 )}
 >
 <d.icon className={cn("w-2.5 h-2.5", d.color)} />
 {d.label} {v.dimensions[d.key]}%
 </span>
 ))}
 </div>
 </div>

 <ChevronRight className={cn("w-5 h-5 text-muted-foreground shrink-0 mt-3 transition-transform duration-200", isExpanded &&"rotate-90")} />
 </div>
 </button>

 {/* Expanded detail */}
 {isExpanded && (
 <div className="px-5 pb-5 border-t border-border/40 pt-4 animate-in slide-in-from-top-2 duration-200">
 {/* Dimension breakdown */}
 <p className="text-fs-xs font-semibold text-heading mb-3 uppercase tracking-wider">Match Breakdown</p>
 <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
 {DIMENSION_CONFIG.map((d) => (
 <div key={d.key} className="flex items-center gap-2">
 <d.icon className={cn("w-3.5 h-3.5 shrink-0", d.color)} />
 <span className="text-fs-xs text-body w-20 shrink-0">{d.label}</span>
 <DimensionBar value={v.dimensions[d.key]} color={d.color} />
 <span className="text-[10px] font-bold tabular-nums text-heading w-8 text-right">{v.dimensions[d.key]}%</span>
 </div>
 ))}
 </div>

 {/* Bio */}
 {v.bio && (
 <div className="mb-4">
 <p className="text-fs-xs font-semibold text-heading mb-1 uppercase tracking-wider">About</p>
 <p className="text-fs-sm text-body leading-relaxed">{v.bio}</p>
 </div>
 )}

 {/* Services */}
 <div className="mb-4">
 <p className="text-fs-xs font-semibold text-heading mb-2 uppercase tracking-wider">Services</p>
 <div className="flex flex-wrap gap-1.5">
 {v.services.map((s) => (
 <span key={s.id} className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
 {s.title}
 {s.price_min ?` · $${s.price_min}` :""}
 {s.price_type ==="hourly" ?"/hr" :""}
 </span>
 ))}
 </div>
 </div>

 {/* Address */}
 {v.address && (
 <p className="text-fs-xs text-muted-foreground flex items-center gap-1 mb-4">
 <MapPin className="w-3 h-3" /> {v.address}
 </p>
 )}

 {/* CTA */}
 <div className="flex flex-wrap gap-2">
 <Button
 onClick={() => navigate(`/book?category=${selectedCategory}&provider=${v.vendor_id}`)}
 className="flex-1 gap-1.5 min-w-[120px]"
 size="sm"
 >
 <Zap className="w-3.5 h-3.5" /> Book Now
 </Button>
 {taskId && (
 <Button
 variant={invitedIds.has(v.vendor_id) ?"secondary" :"default"}
 size="sm"
 className="gap-1.5"
 disabled={invitedIds.has(v.vendor_id) || invitingId === v.vendor_id}
 onClick={() => handleInvite(v)}
 >
 {invitedIds.has(v.vendor_id) ? (
 <>
 <Check className="w-3.5 h-3.5" /> Invited
 </>
 ) : invitingId === v.vendor_id ? (
 <>
 <Loader2 className="w-3.5 h-3.5 animate-spin" /> Inviting…
 </>
 ) : (
 <>
 <Send className="w-3.5 h-3.5" /> Invite to my task
 </>
 )}
 </Button>
 )}
 <Button
 variant="outline"
 size="sm"
 onClick={() => navigate(`/provider/${v.vendor_id}`)}
 >
 View Profile
 </Button>
 </div>
 </div>
 )}
 </div>
 );
 })}
 <NumberedPagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 pageSize={pageSize}
 onPageChange={setPage}
 onPageSizeChange={setPageSize}
 />
 </div>
 )}
 </div>
 </main>
 </div>
 );
};

export default AIMatchPage;
