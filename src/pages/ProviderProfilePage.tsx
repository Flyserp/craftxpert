import { useEffect, useState, useRef, useCallback } from"react";
import { useParams, Link, useNavigate } from"react-router-dom";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import Footer from"@/components/landing/Footer";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/contexts/AuthContext";
import { Button } from"@/components/ui/button";
import {
 Star, MapPin, CheckCircle, Phone, Briefcase, Clock, Calendar, User, Images,
 Award, Flame, ShieldCheck, Zap, MessageSquare, ArrowLeft, BadgeCheck, Send, Crown, Lock, Share2, Heart,
 HelpCircle,
} from"lucide-react";
import { Badge } from"@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from"@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { toast } from"sonner";
import { format } from"date-fns";
import { cn } from"@/lib/utils";
import InviteToTaskModal from"@/components/tasks/InviteToTaskModal";
import SEOHead from"@/components/SEOHead";
import PortfolioLightbox from"@/components/provider/profile/PortfolioLightbox";
import { useFavorites } from"@/hooks/useFavorites";
import TrustVerificationPanel from"@/components/provider/profile/TrustVerificationPanel";
import StickyBookingSidebar from"@/components/provider/profile/StickyBookingSidebar";
import ProviderFAQ from"@/components/provider/profile/ProviderFAQ";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import { providerUrl, extractProviderId } from"@/lib/providerUrl";
import ReportButton from "@/components/moderation/ReportButton";
import { RelatedProviders } from "@/components/search/ProviderRecommendations";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

interface VendorProfile {
 display_name: string;
 address: string | null;
 bio: string | null;
 phone: string | null;
 avatar_url: string | null;
 created_at: string;
 vacation_mode?: boolean;
 vacation_until?: string | null;
 show_availability_public?: boolean;
}

interface Service {
 id: string;
 title: string;
 description: string | null;
 price_min: number | null;
 price_max: number | null;
 price_type: string;
 category_id: string;
 category_name: string;
}

interface Review {
 id: string;
 rating: number;
 comment: string | null;
 created_at: string;
 customer_name: string;
 customer_avatar: string | null;
 before_photos: string[];
 after_photos: string[];
 vendor_reply: string | null;
 vendor_reply_at: string | null;
}

export default function ProviderProfilePage() {
 const { providerId: routeParam } = useParams<{ providerId: string }>();
 const providerId = extractProviderId(routeParam);
 const navigate = useNavigate();
 const { user, roles, signOut } = useAuth();
 const cannotBook = !!user && roles.length > 0 && !roles.includes("customer");
 const handleSwitchAccount = async () => {
 const redirect = window.location.pathname + window.location.search;
 await signOut();
 navigate(`/signup?redirect=${encodeURIComponent(redirect)}`);
 };
 const [profile, setProfile] = useState<VendorProfile | null>(null);
 const [services, setServices] = useState<Service[]>([]);
 const [reviews, setReviews] = useState<Review[]>([]);
 const [portfolio, setPortfolio] = useState<{ id: string; image_url: string; caption: string | null; media_type: "image" | "video" | "pdf"; title: string | null; description: string | null }[]>([]);
 const [availability, setAvailability] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);
 const [completedJobs, setCompletedJobs] = useState(0);
 const [avgResponseMinutes, setAvgResponseMinutes] = useState<number | null>(null);
 const [planName, setPlanName] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
 const [inviteOpen, setInviteOpen] = useState(false);
 const canInvite = !!user && roles.includes("customer") && !!providerId;
 const { isFavorite, toggleFavorite } = useFavorites();
 const saved = providerId ? isFavorite(providerId) : false;
 const { siteName } = usePwaBranding();
 const brand = siteName || "TaskHive";

 // Contact form state
 const [contactMessage, setContactMessage] = useState("");
 const [sendingMessage, setSendingMessage] = useState(false);
 const [messageSent, setMessageSent] = useState(false);
 const contactRef = useRef<HTMLTextAreaElement>(null);

 useEffect(() => {
 if (!providerId) return;
 const fetchData = async () => {
 const [profileRes, servicesRes, reviewsRes, portfolioRes, bookingsRes] = await Promise.all([
 supabase.from("profiles").select("display_name, address, bio, phone, avatar_url, created_at, vacation_mode, vacation_until, show_availability_public").eq("user_id", providerId).single(),
 supabase.from("vendor_services").select("id, title, description, price_min, price_max, price_type, category_id, category:service_categories(name)").eq("vendor_id", providerId).eq("is_active", true),
 supabase.from("reviews").select("id, rating, comment, created_at, customer_id, before_photos, after_photos, vendor_reply, vendor_reply_at").eq("vendor_id", providerId).order("created_at", { ascending: false }).limit(20),
 supabase.from("vendor_portfolio").select("id, image_url, caption, media_type, title, description").eq("vendor_id", providerId).order("sort_order", { ascending: true }),
 supabase.from("bookings").select("id", { count:"exact", head: true }).eq("vendor_id", providerId).eq("status","completed"),
 ]);

 if (profileRes.data) {
  setProfile(profileRes.data as any);
  if ((profileRes.data as any).show_availability_public !== false) {
   const { data: avail } = await supabase
    .from("vendor_availability")
    .select("day_of_week, start_time, end_time")
    .eq("vendor_id", providerId)
    .eq("is_available", true)
    .order("day_of_week").order("start_time");
   setAvailability((avail as any[]) ?? []);
  }
 }
 setPortfolio((portfolioRes.data as any[]) || []);
 setCompletedJobs(bookingsRes.count || 0);
 setPlanName(null);

 setServices(
 (servicesRes.data || []).map((s: any) => ({
 ...s,
 category_name: s.category?.name ||"Other",
 }))
 );

 if (reviewsRes.data && reviewsRes.data.length > 0) {
 const customerIds = [...new Set(reviewsRes.data.map((r: any) => r.customer_id))];
 const { data: customers } = await supabase
 .from("profiles")
 .select("user_id, display_name, avatar_url")
 .in("user_id", customerIds);

 const custMap: Record<string, { name: string; avatar: string | null }> = {};
 (customers || []).forEach((c) => {
 custMap[c.user_id] = { name: c.display_name ||"Customer", avatar: c.avatar_url };
 });

 setReviews(
 reviewsRes.data.map((r: any) => ({
 id: r.id,
 rating: r.rating,
 comment: r.comment,
 created_at: r.created_at,
 customer_name: custMap[r.customer_id]?.name ||"Customer",
 customer_avatar: custMap[r.customer_id]?.avatar || null,
 before_photos: r.before_photos || [],
 after_photos: r.after_photos || [],
 vendor_reply: r.vendor_reply || null,
 vendor_reply_at: r.vendor_reply_at || null,
 }))
 );
 }

 // Compute average response time: for each conversation involving the provider,
 // find pairs where a counterpart message is followed by a provider reply, and average the gap.
 try {
 const { data: convos } = await supabase
 .from("conversations")
 .select("id")
 .or(`participant_1.eq.${providerId},participant_2.eq.${providerId}`)
 .order("last_message_at", { ascending: false })
 .limit(20);
 const convoIds = (convos || []).map((c: any) => c.id);
 if (convoIds.length > 0) {
 const { data: msgs } = await supabase
 .from("messages")
 .select("conversation_id, sender_id, created_at")
 .in("conversation_id", convoIds)
 .order("created_at", { ascending: true })
 .limit(1000);
 const gaps: number[] = [];
 const grouped: Record<string, any[]> = {};
 (msgs || []).forEach((m: any) => {
 (grouped[m.conversation_id] ||= []).push(m);
 });
 Object.values(grouped).forEach((list) => {
 for (let i = 1; i < list.length; i++) {
 const prev = list[i - 1];
 const cur = list[i];
 if (prev.sender_id !== providerId && cur.sender_id === providerId) {
 const diff = (new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime()) / 60000;
 if (diff >= 0 && diff < 60 * 24 * 7) gaps.push(diff);
 }
 }
 });
 if (gaps.length > 0) {
 setAvgResponseMinutes(gaps.reduce((a, b) => a + b, 0) / gaps.length);
 }
 }
 } catch {
 // ignore — stat just won't show
 }

 setLoading(false);
 };
 fetchData();
 }, [providerId]);

 // Redirect bare UUID URLs to the clean slug URL once the profile loads.
 useEffect(() => {
   if (!providerId || !profile?.display_name || !routeParam) return;
   const clean = providerUrl(providerId, profile.display_name).slice("/provider/".length);
   if (routeParam !== clean) {
     window.history.replaceState(null, "", `/provider/${clean}${window.location.search}${window.location.hash}`);
   }
 }, [providerId, profile?.display_name, routeParam]);

 const avgRating = reviews.length
 ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
 : 0;

 const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
 star,
 count: reviews.filter((r) => r.rating === star).length,
 pct: reviews.length ? Math.round((reviews.filter((r) => r.rating === star).length / reviews.length) * 100) : 0,
 }));

 // Unique skills from service categories
 const skills = [...new Set(services.map((s) => s.category_name))];

 // Achievement badges
 const badges: { label: string; icon: React.ReactNode; variant:"default" |"secondary" |"outline" }[] = [];
 if (avgRating >= 4.8 && reviews.length >= 3) badges.push({ label:"Top Rated", icon: <Award className="w-3 h-3" />, variant:"default" });
 if (reviews.length >= 10) badges.push({ label:"Trusted Pro", icon: <ShieldCheck className="w-3 h-3" />, variant:"secondary" });
 if (services.length >= 3) badges.push({ label:"Multi-Skill", icon: <Zap className="w-3 h-3" />, variant:"outline" });
 const fiveStarPct = reviews.length ? (reviews.filter((r) => r.rating === 5).length / reviews.length) * 100 : 0;
 if (fiveStarPct >= 80 && reviews.length >= 3) badges.push({ label:"5★ Favorite", icon: <Flame className="w-3 h-3" />, variant:"default" });
 if (portfolio.length >= 5) badges.push({ label:"Portfolio Pro", icon: <Images className="w-3 h-3" />, variant:"secondary" });
 if (completedJobs >= 10) badges.push({ label:"Experienced", icon: <Briefcase className="w-3 h-3" />, variant:"outline" });

 const defaultCategoryId = services[0]?.category_id ||"";
 const { page: servicesPage, setPage: setServicesPage, totalPages: servicesTotalPages, totalItems: servicesTotalItems, pageItems: paginatedServices, pageSize: servicesPageSize, setPageSize: setServicesPageSize } = usePagination(services, 6);
 const { page: portfolioPage, setPage: setPortfolioPage, totalPages: portfolioTotalPages, totalItems: portfolioTotalItems, pageItems: paginatedPortfolio, pageSize: portfolioPageSize, setPageSize: setPortfolioPageSize } = usePagination(portfolio, 9);
 const { page: reviewsPage, setPage: setReviewsPage, totalPages: reviewsTotalPages, totalItems: reviewsTotalItems, pageItems: paginatedReviews, pageSize: reviewsPageSize, setPageSize: setReviewsPageSize } = usePagination(reviews, 6);

 const handleShare = async () => {
 const url =`${window.location.origin}/provider/${providerId}`;
 const shareData = {
 title:`${profile?.display_name ||"Service Pro"} on ${brand}`,
 text: profile?.bio ||`Check out ${profile?.display_name} on ${brand}`,
 url,
 };
 const canNativeShare =
 typeof navigator !=="undefined" &&
 typeof navigator.share ==="function" &&
 (!("canShare" in navigator) || (navigator as any).canShare?.(shareData));
 try {
 if (canNativeShare) {
 await navigator.share(shareData);
 return;
 }
 await navigator.clipboard.writeText(url);
 toast.success("Profile link copied to clipboard");
 } catch (err: any) {
 if (err?.name ==="AbortError") return;
 try {
 await navigator.clipboard.writeText(url);
 toast.success("Profile link copied to clipboard");
 } catch {
 toast.error("Couldn't share or copy link");
 }
 }
 };

 const handleSendMessage = async () => {
 if (!contactMessage.trim()) return;
 if (!user) {
 navigate(`/login?redirect=/provider/${providerId}`);
 return;
 }
 if (user.id === providerId) {
 toast.error("You can't message yourself");
 return;
 }
 if (contactMessage.trim().length > 1000) {
 toast.error("Message is too long (max 1000 characters)");
 return;
 }

 setSendingMessage(true);
 try {
 // Find or create conversation
 const { data: existing } = await supabase
 .from("conversations")
 .select("id")
 .or(`and(participant_1.eq.${user.id},participant_2.eq.${providerId}),and(participant_1.eq.${providerId},participant_2.eq.${user.id})`)
 .limit(1);

 let convoId: string;
 if (existing && existing.length > 0) {
 convoId = existing[0].id;
 } else {
 const { data: newConvo, error } = await supabase
 .from("conversations")
 .insert({ participant_1: user.id, participant_2: providerId! })
 .select("id")
 .single();
 if (error || !newConvo) throw new Error("Failed to create conversation");
 convoId = newConvo.id;
 }

 // Send the message
 const { error: msgError } = await supabase
 .from("messages")
 .insert({
 conversation_id: convoId,
 sender_id: user.id,
 content: contactMessage.trim(),
 });

 if (msgError) throw msgError;

 // Update last_message_at
 await supabase
 .from("conversations")
 .update({ last_message_at: new Date().toISOString() })
 .eq("id", convoId);

 setContactMessage("");
 setMessageSent(true);
 toast.success("Message sent!", {
 description:"The professional will be notified.",
 action: {
 label:"Open Chat",
 onClick: () => navigate(`/chat/${convoId}`),
 },
 });

 setTimeout(() => setMessageSent(false), 5000);
 } catch (err: any) {
 toast.error(err.message ||"Failed to send message");
 } finally {
 setSendingMessage(false);
 }
 };

 if (loading) {
 return (
 <div className="min-h-screen">
 <UnifiedHeader />
 <main className="pb-16">
 <div className="container-app max-w-3xl">
 <div className="h-48 bg-muted rounded-sm animate-pulse mb-6" />
 <div className="space-y-4">
 {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-sm animate-pulse" />)}
 </div>
 </div>
 </main>
 </div>
 );
 }

 if (!profile) {
 return (
 <div className="min-h-screen">
 <UnifiedHeader />
 <main className="pb-16 text-center">
 <div className="container-app">
 <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
 <Heading level={1}  className="mb-2">Provider Not Found</Heading>
 <Link to="/browse"><Button>Browse Services</Button></Link>
 </div>
 </main>
 </div>
 );
 }

 const cleanPath = providerId ? providerUrl(providerId, profile.display_name) : `/provider/${routeParam}`;
 const canonical = typeof window !=="undefined" ?`${window.location.origin}${cleanPath}` : cleanPath;
 const seoTitle =`${profile.display_name} – ${skills.slice(0, 2).join(" &") ||"Service Pro"}`;
 const seoDesc = (profile.bio?.trim() ||`Book ${profile.display_name}, a verified pro${profile.address ?` in ${profile.address}` :""}. ${reviews.length} reviews · ${avgRating ||"new"}★ · ${completedJobs} jobs completed.`).slice(0, 160);
 const seoImage = profile.avatar_url || undefined;
 const jsonLd = {
"@context":"https://schema.org",
"@graph": [
  {
 "@type":"BreadcrumbList",
   itemListElement: [
    {"@type":"ListItem", position: 1, name:"Home", item: typeof window !=="undefined" ? window.location.origin +"/" :"/" },
    {"@type":"ListItem", position: 2, name:"Browse", item: typeof window !=="undefined" ? window.location.origin +"/browse" :"/browse" },
    {"@type":"ListItem", position: 3, name: profile.display_name, item: canonical },
   ],
  },
 {
"@type":"Person",
 name: profile.display_name,
 description: profile.bio || undefined,
 image: profile.avatar_url || undefined,
 telephone: profile.phone || undefined,
 address: profile.address || undefined,
 url: canonical,
 knowsAbout: skills,
 },
 {
"@type":"LocalBusiness",
 name: profile.display_name,
 image: profile.avatar_url || undefined,
 telephone: profile.phone || undefined,
 address: profile.address ? {"@type":"PostalAddress", streetAddress: profile.address } : undefined,
 url: canonical,
 priceRange: services.length
 ?`$${Math.min(...services.map((s) => s.price_min ?? 0).filter(Boolean))} - $${Math.max(...services.map((s) => s.price_max ?? s.price_min ?? 0))}`
 : undefined,
 aggregateRating: reviews.length
 ? {"@type":"AggregateRating", ratingValue: avgRating, reviewCount: reviews.length, bestRating: 5, worstRating: 1 }
 : undefined,
 review: reviews.slice(0, 5).map((r) => ({
"@type":"Review",
 reviewRating: {"@type":"Rating", ratingValue: r.rating, bestRating: 5 },
 author: {"@type":"Person", name: r.customer_name },
 datePublished: r.created_at,
 reviewBody: r.comment || undefined,
 })),
 },
 ],
 };

 return (
 <div className="min-h-screen">
 <SEOHead
 title={seoTitle}
 description={seoDesc}
 canonical={canonical}
 type="article"
 image={seoImage}
 jsonLd={jsonLd}
 />
 <UnifiedHeader />

 {/* Hero gradient banner */}
 <section className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-b border-border/40">
 <div className="container-app max-w-3xl py-6 relative z-10">
 <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2 mb-2">
 <ArrowLeft className="w-4 h-4" /> Back
 </Button>
 <nav className="flex items-center gap-1.5 text-fs-sm text-muted-foreground">
 <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
 <span className="text-muted-foreground/50">/</span>
 <Link to="/browse" className="hover:text-foreground transition-colors">Browse</Link>
 <span className="text-muted-foreground/50">/</span>
 <span className="text-foreground font-medium truncate">{profile.display_name}</span>
 </nav>
 </div>
 <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none">
 <User className="w-72 h-72" />
 </div>
 </section>

 <main className="pb-16">
 <div className="container-app max-w-3xl py-6">
 {cannotBook && (
 <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
 <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
 <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
 <p className="text-fs-sm text-heading leading-relaxed">
 You're signed in with a non-customer account. <span className="font-semibold">Booking and messaging require a customer account</span>.
 </p>
 <button
 onClick={handleSwitchAccount}
 className="text-fs-sm font-semibold text-primary hover:underline whitespace-nowrap"
 >
 Switch account →
 </button>
 </div>
 </div>
 )}
 {/* ─── Hero Card ─── */}
 <div className="bg-card rounded-sm border border-border overflow-hidden mb-6 animate-reveal">
 {/* Cover gradient */}
 <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />

 <div className="px-6 pb-6 -mt-10">
 <div className="flex items-end gap-4 mb-4">
 {/* Avatar */}
 <div className="w-20 h-20 rounded-sm bg-card border-4 border-card overflow-hidden shrink-0">
 {profile.avatar_url ? (
 <img src={profile.avatar_url} alt={profile.display_name ||""} className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full bg-primary/10 flex items-center justify-center text-fs-xl font-bold text-primary">
 {(profile.display_name ||"V").slice(0, 2).toUpperCase()}
 </div>
 )}
 </div>

 {/* Name + verified */}
 <div className="flex-1 min-w-0 pb-1">
 <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
 <Heading level={1}  className="truncate">{profile.display_name}</Heading>
 <BadgeCheck className="w-5 h-5 text-primary shrink-0" />
 {planName && (
 <Badge
 variant="outline"
 className={cn(
"text-[10px] px-2 py-0.5 font-bold gap-1 shrink-0",
 planName ==="Elite"
 ?"border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-400/40"
 :"border-primary/40 bg-primary/5 text-primary"
 )}
 >
 {planName ==="Elite" ? <Crown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
 {planName}
 </Badge>
 )}
 </div>
 <div className="flex flex-wrap items-center gap-3 text-fs-xs text-muted-foreground">
 {profile.address && (
 <span className="flex items-center gap-1">
 <MapPin className="w-3 h-3" /> {profile.address}
 </span>
 )}
 {profile.phone && (
 <span className="flex items-center gap-1">
 <Phone className="w-3 h-3" /> {profile.phone}
 </span>
 )}
 <span className="flex items-center gap-1">
 <Calendar className="w-3 h-3" /> Joined {format(new Date(profile.created_at),"MMM yyyy")}
 </span>
 </div>
 </div>
 </div>

 {/* Achievement badges */}
 {badges.length > 0 && (
 <div className="flex flex-wrap gap-1.5 mb-3">
 {badges.map((b) => (
 <Badge key={b.label} variant={b.variant} className="gap-1 text-[10px] px-2 py-0.5">
 {b.icon} {b.label}
 </Badge>
 ))}
 </div>
 )}

 {/* Bio */}
 {profile.bio && (
 <p className="text-fs-sm text-body leading-relaxed mb-4">{profile.bio}</p>
 )}

 {/* Stats row */}
 {(() => {
 const yearsOnPlatform = Math.max(
 0,
 (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
 );
 const yearsLabel = yearsOnPlatform < 1
 ?`${Math.max(1, Math.round(yearsOnPlatform * 12))}mo`
 :`${yearsOnPlatform >= 10 ? Math.round(yearsOnPlatform) : yearsOnPlatform.toFixed(1)}y`;
 const responseLabel = avgResponseMinutes == null
 ?"—"
 : avgResponseMinutes < 60
 ?`${Math.max(1, Math.round(avgResponseMinutes))}m`
 : avgResponseMinutes < 60 * 24
 ?`${(avgResponseMinutes / 60).toFixed(1)}h`
 :`${Math.round(avgResponseMinutes / (60 * 24))}d`;
 return (
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">{avgRating ||"—"}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Avg Rating</p>
 </div>
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">{reviews.length}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Reviews</p>
 </div>
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">{completedJobs}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Jobs Done</p>
 </div>
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">
 {reviews.length > 0
 ?`${Math.round((reviews.filter((r) => r.vendor_reply).length / reviews.length) * 100)}%`
 :"—"}
 </p>
 <p className="text-[10px] text-muted-foreground font-medium">Reply Rate</p>
 </div>
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">{yearsLabel}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Experience</p>
 </div>
 <div className="bg-muted/50 rounded-sm p-3 text-center">
 <p className="text-fs-lg font-bold text-heading tabular-nums">{responseLabel}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Avg Reply</p>
 </div>
 </div>
 );
 })()}

 {/* Skills */}
 {skills.length > 0 && (
 <div className="mb-4">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Skills</p>
 <div className="flex flex-wrap gap-1.5">
 {skills.map((sk) => (
 <span key={sk} className="px-2.5 py-1 rounded-full text-fs-xs font-medium bg-secondary text-secondary-foreground">
 {sk}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Actions */}
 <div className="flex gap-3">
 {cannotBook ? (
 <Button
 onClick={() => navigate(`/login?redirect=/provider/${providerId}`)}
 className="flex-1 gap-2"
 size="lg"
 >
 <Lock className="w-4 h-4" /> Sign in to Book
 </Button>
 ) : (
 <Button
 onClick={() => navigate(`/book?category=${defaultCategoryId}&provider=${providerId}`)}
 className="flex-1 gap-2"
 size="lg"
 >
 <Calendar className="w-4 h-4" /> Book Now
 </Button>
 )}
 {cannotBook ? (
 <TooltipProvider delayDuration={150}>
 <Tooltip>
 <TooltipTrigger asChild>
 <span>
 <Button variant="outline" size="lg" disabled className="gap-2 pointer-events-auto cursor-not-allowed">
 <Lock className="w-4 h-4" /> Message
 </Button>
 </span>
 </TooltipTrigger>
 <TooltipContent side="top">Messaging requires a customer account</TooltipContent>
 </Tooltip>
 </TooltipProvider>
 ) : (
 <Button
 variant="outline"
 size="lg"
 onClick={() => navigate(`/chat?with=${providerId}`)}
 className="gap-2"
 >
 <MessageSquare className="w-4 h-4" /> Message
 </Button>
 )}
 {canInvite && (
 <Button
 variant="outline"
 size="lg"
 onClick={() => setInviteOpen(true)}
 className="gap-2"
 >
 <Send className="w-4 h-4" /> Invite to Task
 </Button>
 )}
 <Button
 variant="outline"
 size="lg"
 onClick={handleShare}
 className="gap-2"
 aria-label="Share profile"
 >
 <Share2 className="w-4 h-4" /> Share
 </Button>
 {roles.includes("customer") && providerId && (
  <Button
   variant="outline"
   size="lg"
   onClick={() => toggleFavorite(providerId)}
   className={cn("gap-2", saved && "border-destructive/40 text-destructive")}
   aria-label={saved ? "Remove from saved" : "Save provider"}
  >
   <Heart className={cn("w-4 h-4", saved && "fill-destructive")} />
   {saved ? "Saved" : "Save"}
  </Button>
 )}
  {providerId && user?.id && user.id !== providerId && (
    <ReportButton entityType="profile" entityId={providerId} />
  )}
 </div>
 </div>
 </div>

 {/* ─── Tabbed content + sticky booking sidebar ─── */}
 <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
 <div className="min-w-0">
 <Tabs defaultValue="about" className="w-full">
 <TabsList className="w-full justify-start sticky top-16 z-30 bg-background/85 backdrop-blur-md border border-border/40 h-auto p-1 mb-4 overflow-x-auto flex">
 <TabsTrigger value="about" className="gap-1.5"><User className="w-3.5 h-3.5" />About</TabsTrigger>
 <TabsTrigger value="services" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Services<span className="text-[10px] opacity-70">({services.length})</span></TabsTrigger>
 <TabsTrigger value="portfolio" className="gap-1.5"><Images className="w-3.5 h-3.5" />Portfolio<span className="text-[10px] opacity-70">({portfolio.length})</span></TabsTrigger>
 <TabsTrigger value="reviews" className="gap-1.5"><Star className="w-3.5 h-3.5" />Reviews<span className="text-[10px] opacity-70">({reviews.length})</span></TabsTrigger>
 <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="w-3.5 h-3.5" />FAQ</TabsTrigger>
 </TabsList>

 <TabsContent value="about" className="space-y-6 mt-0">
 {profile.vacation_mode && (!profile.vacation_until || profile.vacation_until >= new Date().toISOString().slice(0, 10)) && (
  <div className="rounded-sm border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3 animate-reveal">
   <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
   <div>
    <p className="text-fs-sm font-semibold text-heading">Currently on vacation</p>
    <p className="text-fs-xs text-muted-foreground">
     {profile.display_name} isn't accepting new bookings right now
     {profile.vacation_until ? ` and will return on ${new Date(profile.vacation_until + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}.
    </p>
   </div>
  </div>
 )}
 {profile.show_availability_public !== false && availability.length > 0 && (
  <div className="bg-card rounded-sm border border-border p-6 animate-reveal" style={{ animationDelay: "30ms" }}>
   <Heading level={2}  className="flex items-center gap-2 mb-4">
    <Clock className="w-4 h-4 text-primary" /> Weekly Availability
   </Heading>
   <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
    {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day, i) => {
     const daySlots = availability.filter((a) => a.day_of_week === i);
     return (
      <div key={day} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
       <span className="text-fs-sm font-medium text-heading">{day}</span>
       {daySlots.length === 0 ? (
        <span className="text-fs-xs text-muted-foreground">Closed</span>
       ) : (
        <span className="text-fs-xs text-muted-foreground">
         {daySlots.map((s) => `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`).join(", ")}
        </span>
       )}
      </div>
     );
    })}
   </div>
  </div>
 )}
 <TrustVerificationPanel
 joinedAt={profile.created_at}
 hasPhone={!!profile.phone}
 completedJobs={completedJobs}
 reviewCount={reviews.length}
 replyRatePct={reviews.length > 0
 ? Math.round((reviews.filter((r) => r.vendor_reply).length / reviews.length) * 100)
 : null}
 avgResponseMinutes={avgResponseMinutes}
 />
 {/* ─── Rating Breakdown ─── */}
 {reviews.length > 0 && (
 <div className="bg-card rounded-sm border border-border p-6 mb-6 animate-reveal" style={{ animationDelay:"60ms" }}>
 <Heading level={2}  className="flex items-center gap-2 mb-4">
 <Star className="w-4 h-4 text-primary" /> Rating Breakdown
 </Heading>
 <div className="flex items-center gap-6">
 <div className="text-center shrink-0">
 <p className="text-fs-4xl font-bold text-heading tabular-nums leading-none">{avgRating}</p>
 <div className="flex items-center gap-0.5 mt-2 justify-center">
 {[1, 2, 3, 4, 5].map((s) => (
 <Star
 key={s}
 className={cn("w-4 h-4", s <= Math.round(avgRating) ?"text-amber-400 fill-amber-400" :"text-border")}
 />
 ))}
 </div>
 <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ?"s" :""}</p>
 </div>
 <div className="flex-1 space-y-1.5">
 {ratingDist.map((d) => (
 <div key={d.star} className="flex items-center gap-2 text-fs-xs">
 <span className="w-3 text-right text-muted-foreground tabular-nums">{d.star}</span>
 <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
 <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-amber-400 rounded-full transition-all duration-500"
 style={{ width:`${d.pct}%` }}
 />
 </div>
 <span className="w-6 text-right text-muted-foreground tabular-nums">{d.count}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 </TabsContent>

 <TabsContent value="services" className="mt-0">
 {/* ─── Services ─── */}
 <div className="mb-6 animate-reveal" style={{ animationDelay:"100ms" }}>
 <Heading level={2}  className="flex items-center gap-2 mb-4">
 <Briefcase className="w-4 h-4 text-primary" />
 Services ({services.length})
 </Heading>

 {services.length === 0 ? (
 <p className="text-fs-sm text-muted-foreground">No active services listed.</p>
 ) : (
 <>
 <div className="space-y-3">
 {paginatedServices.map((s) => (
 <div key={s.id} className="bg-card rounded-sm border border-border p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <Heading level={3} >{s.title}</Heading>
 <p className="text-fs-xs text-muted-foreground">{s.category_name}</p>
 {s.description && (
 <p className="text-fs-xs text-body mt-1 line-clamp-2">{s.description}</p>
 )}
 </div>
 <div className="text-right shrink-0">
 {s.price_min != null && (
 <p className="text-fs-sm font-semibold text-heading tabular-nums">
 ${s.price_min}{s.price_max ?`–$${s.price_max}` :""}
 </p>
 )}
 <p className="text-[10px] text-muted-foreground capitalize">{s.price_type}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 <NumberedPagination
 currentPage={servicesPage}
 totalPages={servicesTotalPages}
 totalItems={servicesTotalItems}
 pageSize={servicesPageSize}
 onPageChange={setServicesPage}
 onPageSizeChange={setServicesPageSize}
 />
 </>
 )}
 </div>

 </TabsContent>

 <TabsContent value="portfolio" className="mt-0">
 {/* ─── Portfolio Gallery ─── */}
 {portfolio.length > 0 && (
 <div className="mb-6 animate-reveal" style={{ animationDelay:"140ms" }}>
 <Heading level={2}  className="flex items-center gap-2 mb-4">
 <Images className="w-4 h-4 text-primary" />
 Portfolio ({portfolio.length})
 </Heading>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {paginatedPortfolio.map((p) => (
 <button
 key={p.id}
 onClick={() => setLightboxIdx(portfolio.findIndex((item) => item.id === p.id))}
 className="group aspect-[4/3] rounded-sm overflow-hidden ring-1 ring-border/40 cursor-pointer bg-muted relative text-left"
 >
 {p.media_type === "video" ? (
 <video src={p.image_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
 ) : p.media_type === "pdf" ? (
 <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-3">
 <Images className="w-8 h-8 opacity-0" />
 <span className="text-fs-xs font-medium truncate max-w-full">{p.title || "PDF document"}</span>
 </div>
 ) : (
 <img
 src={p.image_url}
 alt={p.title || p.caption ||"Portfolio work"}
 className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
 loading="lazy"
 />
 )}
 {(p.title || p.description) && (
 <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 to-transparent p-2">
 {p.title && <p className="text-fs-xs font-semibold text-background truncate">{p.title}</p>}
 {p.description && <p className="text-[10px] text-background/80 line-clamp-1">{p.description}</p>}
 </div>
 )}
 {p.media_type !== "image" && (
 <span className="absolute top-1.5 right-1.5 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold">
 {p.media_type.toUpperCase()}
 </span>
 )}
 </button>
 ))}
 </div>
 <NumberedPagination
 currentPage={portfolioPage}
 totalPages={portfolioTotalPages}
 totalItems={portfolioTotalItems}
 pageSize={portfolioPageSize}
 onPageChange={setPortfolioPage}
 onPageSizeChange={setPortfolioPageSize}
 />
 </div>
 )}

 {/* Lightbox handled by PortfolioLightbox below the grid */}

 </TabsContent>

 <TabsContent value="reviews" className="mt-0">
 {/* ─── Reviews ─── */}
 <div className="animate-reveal" style={{ animationDelay:"180ms" }}>
 <Heading level={2}  className="flex items-center gap-2 mb-4">
 <MessageSquare className="w-4 h-4 text-primary" />
 Reviews ({reviews.length})
 </Heading>

 {reviews.length === 0 ? (
 <p className="text-fs-sm text-muted-foreground">No reviews yet.</p>
 ) : (
 <>
 <div className="space-y-3">
 {paginatedReviews.map((r) => (
 <div key={r.id} className="bg-card rounded-sm border border-border p-4">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
 {r.customer_avatar ? (
 <img src={r.customer_avatar} alt="" className="w-full h-full object-cover" />
 ) : (
 r.customer_name[0].toUpperCase()
 )}
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <span className="text-fs-sm font-medium text-heading">{r.customer_name}</span>
 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
 <CheckCircle className="w-2.5 h-2.5" /> Verified Booking
 </span>
 </div>
 <div className="flex items-center gap-0.5">
 {[1, 2, 3, 4, 5].map((s) => (
 <Star
 key={s}
 className={cn("w-3 h-3", s <= r.rating ?"text-amber-400 fill-amber-400" :"text-border")}
 />
 ))}
 </div>
 </div>
 </div>
 <span className="text-[10px] text-muted-foreground">
 {format(new Date(r.created_at),"MMM d, yyyy")}
 </span>
 </div>

 {r.comment && (
 <p className="text-fs-sm text-body leading-relaxed mb-2">{r.comment}</p>
 )}
 {user?.id && (
   <div className="-mt-1 mb-1 flex justify-end">
     <ReportButton entityType="review" entityId={r.id} size="icon" />
   </div>
 )}

 {/* Before/After Photos */}
 {(r.before_photos.length > 0 || r.after_photos.length > 0) && (
 <div className="mt-3 space-y-2">
 {r.before_photos.length > 0 && (
 <div>
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Before</p>
 <div className="flex gap-1.5 flex-wrap">
 {r.before_photos.map((url, i) => (
 <img
 key={i}
 src={url}
 alt="Before"
 className="w-20 h-20 rounded-lg object-cover border border-border/60 cursor-pointer hover:opacity-80 transition-opacity"
 onClick={() => window.open(url,"_blank")}
 />
 ))}
 </div>
 </div>
 )}
 {r.after_photos.length > 0 && (
 <div>
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">After</p>
 <div className="flex gap-1.5 flex-wrap">
 {r.after_photos.map((url, i) => (
 <img
 key={i}
 src={url}
 alt="After"
 className="w-20 h-20 rounded-lg object-cover border border-border/60 cursor-pointer hover:opacity-80 transition-opacity"
 onClick={() => window.open(url,"_blank")}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Vendor Reply */}
 {r.vendor_reply && (
 <div className="mt-3 ml-4 pl-3 border-l-2 border-primary/30">
 <div className="flex items-center gap-1.5 mb-1">
 <BadgeCheck className="w-3.5 h-3.5 text-primary" />
 <span className="text-[13px] font-semibold text-heading">Provider Response</span>
 {r.vendor_reply_at && (
 <span className="text-[10px] text-muted-foreground">
 · {format(new Date(r.vendor_reply_at),"MMM d, yyyy")}
 </span>
 )}
 </div>
 <p className="text-fs-xs text-body leading-relaxed">{r.vendor_reply}</p>
 </div>
 )}
 </div>
 ))}
 </div>
 <NumberedPagination
 currentPage={reviewsPage}
 totalPages={reviewsTotalPages}
 totalItems={reviewsTotalItems}
 pageSize={reviewsPageSize}
 onPageChange={setReviewsPage}
 onPageSizeChange={setReviewsPageSize}
 />
 </>
 )}
 </div>

 </TabsContent>

 <TabsContent value="about" className="space-y-6 mt-0" forceMount hidden>
 {/* ─── Contact Professional (rendered in About tab) ─── */}
 <div className="mb-6 animate-reveal" style={{ animationDelay:"220ms" }}>
 <Heading level={2}  className="flex items-center gap-2 mb-4">
 <Send className="w-4 h-4 text-primary" />
 Contact Professional
 </Heading>
 <div className="bg-card rounded-sm border border-border p-5">
 {messageSent ? (
 <div className="text-center py-6">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
 <CheckCircle className="w-6 h-6 text-primary" />
 </div>
 <p className="text-fs-sm font-semibold text-heading mb-1">Message Sent!</p>
 <p className="text-fs-xs text-muted-foreground mb-3">
 {profile?.display_name} will be notified and can reply in chat.
 </p>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setMessageSent(false)}
 className="gap-1.5 text-fs-xs"
 >
 <Send className="w-3 h-3" /> Send Another
 </Button>
 </div>
 ) : (
 <>
 <p className="text-fs-xs text-muted-foreground mb-3">
 Ask about availability, pricing, or describe your project. {profile?.display_name} typically responds within a few hours.
 </p>
 <textarea
 ref={contactRef}
 value={contactMessage}
 onChange={(e) => setContactMessage(e.target.value)}
 placeholder={`Hi ${profile?.display_name?.split("")[0] ||"there"}, I'm interested in your services...`}
 maxLength={1000}
 className="w-full min-h-[100px] p-3 rounded-sm border border-input bg-background text-fs-sm resize-none transition-shadow"
 />
 <div className="flex items-center justify-between mt-3">
 <span className="text-[10px] text-muted-foreground tabular-nums">
 {contactMessage.length}/1000
 </span>
 <div className="flex gap-2">
 {user && (
 <Button
 variant="ghost"
 size="sm"
 className="gap-1.5 text-fs-xs"
 onClick={() => navigate(`/chat?with=${providerId}`)}
 >
 <MessageSquare className="w-3.5 h-3.5" /> Open Full Chat
 </Button>
 )}
 <Button
 size="sm"
 className="gap-1.5"
 onClick={handleSendMessage}
 disabled={sendingMessage || !contactMessage.trim()}
 >
 {sendingMessage ? (
 <>Sending...</>
 ) : (
 <>
 <Send className="w-3.5 h-3.5" /> Send Message
 </>
 )}
 </Button>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="faq" className="mt-0">
 <ProviderFAQ
 providerName={profile.display_name ||"Provider"}
 hasAvailability={true}
 acceptsMessages={!cannotBook}
 />
 </TabsContent>
 </Tabs>
 </div>

 {providerId && (
 <StickyBookingSidebar
 providerId={providerId}
 providerName={profile.display_name ||"Provider"}
 defaultCategoryId={defaultCategoryId}
 defaultServiceId={services[0]?.id}
 priceFromMin={services[0]?.price_min ?? null}
 priceFromMax={services[0]?.price_max ?? null}
 priceType={services[0]?.price_type ?? null}
 avgRating={avgRating}
 reviewCount={reviews.length}
 cannotBook={cannotBook}
 onMessageClick={() => contactRef.current?.focus()}
 onSignInClick={() => navigate(`/login?redirect=/provider/${providerId}`)}
 />
 )}
 </div>

 <PortfolioLightbox
 items={portfolio}
 index={lightboxIdx}
 onClose={() => setLightboxIdx(null)}
 onChange={setLightboxIdx}
 />

 {/* Sticky Book Now (mobile) */}
 <div className="fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border/40 sm:hidden z-40 flex gap-2">
 {cannotBook ? (
 <Button
 onClick={() => navigate(`/login?redirect=/provider/${providerId}`)}
 className="flex-1 gap-2"
 size="lg"
 >
 <Lock className="w-4 h-4" /> Sign in to Book
 </Button>
 ) : (
 <Button
 onClick={() => navigate(`/book?category=${defaultCategoryId}&provider=${providerId}`)}
 className="flex-1 gap-2"
 size="lg"
 >
 <Calendar className="w-4 h-4" /> Book Now
 </Button>
 )}
 {cannotBook ? (
 <TooltipProvider delayDuration={150}>
 <Tooltip>
 <TooltipTrigger asChild>
 <span>
 <Button variant="outline" size="lg" disabled className="pointer-events-auto cursor-not-allowed">
 <Lock className="w-4 h-4" />
 </Button>
 </span>
 </TooltipTrigger>
 <TooltipContent side="top">Messaging requires a customer account</TooltipContent>
 </Tooltip>
 </TooltipProvider>
 ) : (
 <Button
 variant="outline"
 size="lg"
 onClick={() => navigate(`/chat?with=${providerId}`)}
 >
 <MessageSquare className="w-4 h-4" />
 </Button>
 )}
 </div>
 </div>
 {providerId && (
  <div className="container mx-auto px-4 pb-10">
    <RelatedProviders providerId={providerId} limit={4} />
  </div>
 )}
 </main>
 <Footer />
 {providerId && profile && (
 <InviteToTaskModal
 open={inviteOpen}
 onOpenChange={setInviteOpen}
 providerId={providerId}
 providerName={profile.display_name ||"Provider"}
 />
 )}
 </div>
 );
}
