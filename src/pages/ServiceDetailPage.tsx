import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import PageHeroBanner from "@/components/PageHeroBanner";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star, MapPin, Clock, Calendar, DollarSign, Briefcase, ArrowRight,
  Shield, Crown, Zap, MessageSquare, User, CheckCircle, TrendingUp,
  Phone, BadgeCheck, Heart, Lock,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { format } from "date-fns";
import { useFavorites } from "@/hooks/useFavorites";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import ReportButton from "@/components/moderation/ReportButton";
import { Heading, SponsoredBadge } from "@/components/ui/app";
import { StarRating } from "@/components/ui/StarRating";

interface ServiceData {
  id: string;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_type: string;
  vendor_id: string;
  category_id: string;
  subcategory_id: string | null;
  category_name: string;
  subcategory_name: string | null;
  category_icon: string | null;
  is_sponsored: boolean;
  sponsored_until: string | null;
}

interface VendorData {
  display_name: string;
  address: string | null;
  bio: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  plan_name: string | null;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
  customer_avatar: string | null;
  vendor_reply: string | null;
}

interface AvailSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user, roles, signOut } = useAuth();
  const cannotBook = !!user && roles.length > 0 && !roles.includes("customer");
  const handleSwitchAccount = async () => {
    const redirect = window.location.pathname + window.location.search;
    await signOut();
    navigate(`/signup?redirect=${encodeURIComponent(redirect)}`);
  };
  const { toggleFavorite, isFavorite } = useFavorites();

  const [service, setService] = useState<ServiceData | null>(null);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [otherServices, setOtherServices] = useState<{ id: string; title: string; price_min: number | null; price_type: string }[]>([]);
  const [relatedServices, setRelatedServices] = useState<{ id: string; title: string; price_min: number | null; price_type: string; vendor_id: string; vendor_name: string; vendor_avatar: string | null; avg_rating: number; review_count: number }[]>([]);
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serviceId) return;
    fetchService();
  }, [serviceId]);

  const fetchService = async () => {
    const { data: svc } = await supabase
      .from("vendor_services")
      .select("id, title, description, price_min, price_max, price_type, vendor_id, category_id, subcategory_id, is_sponsored, sponsored_until, category:service_categories(name, icon)")
      .eq("id", serviceId!)
      .single();

    if (!svc) { setLoading(false); return; }

    let subcategoryName: string | null = null;
    if (svc.subcategory_id) {
      const { data: sub } = await supabase
        .from("service_subcategories")
        .select("name")
        .eq("id", svc.subcategory_id)
        .single();
      subcategoryName = sub?.name || null;
    }

    const catData = svc.category as any;
    const serviceData: ServiceData = {
      id: svc.id,
      title: svc.title,
      description: svc.description,
      price_min: svc.price_min,
      price_max: svc.price_max,
      price_type: svc.price_type,
      vendor_id: svc.vendor_id,
      category_id: svc.category_id,
      subcategory_id: svc.subcategory_id,
      category_name: catData?.name || "Other",
      subcategory_name: subcategoryName,
      category_icon: catData?.icon || null,
      is_sponsored: !!(svc as any).is_sponsored,
      sponsored_until: (svc as any).sponsored_until ?? null,
    };
    setService(serviceData);

    const [profileRes, reviewsRes, otherRes, availRes, jobsRes] = await Promise.all([
      supabase.from("profiles").select("display_name, address, bio, phone, avatar_url, created_at").eq("user_id", svc.vendor_id).single(),
      supabase.from("reviews").select("id, rating, comment, created_at, customer_id, vendor_reply").eq("vendor_id", svc.vendor_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("vendor_services").select("id, title, price_min, price_type").eq("vendor_id", svc.vendor_id).eq("is_active", true).neq("id", serviceId!).limit(5),
      supabase.from("vendor_availability").select("day_of_week, start_time, end_time").eq("vendor_id", svc.vendor_id).eq("is_available", true).order("day_of_week"),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("vendor_id", svc.vendor_id).eq("status", "completed"),
    ]);

    if (profileRes.data) {
      setVendor({
        ...profileRes.data,
        plan_name: null,
      });
    }

    setOtherServices((otherRes.data as any[]) || []);
    setAvailability((availRes.data as any[]) || []);
    setCompletedJobs(jobsRes.count || 0);

    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const customerIds = [...new Set(reviewsRes.data.map((r: any) => r.customer_id))];
      const { data: customers } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", customerIds);

      const custMap: Record<string, { name: string; avatar: string | null }> = {};
      (customers || []).forEach((c) => {
        custMap[c.user_id] = { name: c.display_name || "Customer", avatar: c.avatar_url };
      });

      setReviews(
        reviewsRes.data.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          customer_name: custMap[r.customer_id]?.name || "Customer",
          customer_avatar: custMap[r.customer_id]?.avatar || null,
          vendor_reply: r.vendor_reply || null,
        }))
      );
    }

    // Fetch related services from same category by other vendors
    const { data: relatedRaw } = await supabase
      .from("vendor_services")
      .select("id, title, price_min, price_type, vendor_id")
      .eq("category_id", svc.category_id)
      .eq("is_active", true)
      .neq("vendor_id", svc.vendor_id)
      .limit(6);

    if (relatedRaw && relatedRaw.length > 0) {
      const relVendorIds = [...new Set(relatedRaw.map((r) => r.vendor_id))];
      const [relProfilesRes, relReviewsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", relVendorIds),
        supabase.from("reviews").select("vendor_id, rating").in("vendor_id", relVendorIds),
      ]);

      const profileMap: Record<string, { name: string; avatar: string | null }> = {};
      (relProfilesRes.data || []).forEach((p) => {
        profileMap[p.user_id] = { name: p.display_name || "Provider", avatar: p.avatar_url };
      });

      const ratingMap: Record<string, { total: number; count: number }> = {};
      (relReviewsRes.data || []).forEach((r) => {
        if (!ratingMap[r.vendor_id]) ratingMap[r.vendor_id] = { total: 0, count: 0 };
        ratingMap[r.vendor_id].total += r.rating;
        ratingMap[r.vendor_id].count += 1;
      });

      setRelatedServices(
        relatedRaw.map((r) => ({
          id: r.id,
          title: r.title,
          price_min: r.price_min,
          price_type: r.price_type,
          vendor_id: r.vendor_id,
          vendor_name: profileMap[r.vendor_id]?.name || "Provider",
          vendor_avatar: profileMap[r.vendor_id]?.avatar || null,
          avg_rating: ratingMap[r.vendor_id] ? +(ratingMap[r.vendor_id].total / ratingMap[r.vendor_id].count).toFixed(1) : 0,
          review_count: ratingMap[r.vendor_id]?.count || 0,
        }))
      );
    }

    setLoading(false);
  };

  const avgRating = reviews.length
    ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0;
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(reviews, 6);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedHeader />
        <div className="container-app max-w-4xl py-12">
          <div className="h-32 bg-muted rounded-sm animate-pulse mb-6" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-sm animate-pulse" />)}
            </div>
            <div className="h-64 bg-muted rounded-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!service || !vendor) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedHeader />
        <main className="container-app max-w-4xl py-16 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <Heading level={1}  className="mb-2">Service Not Found</Heading>
          <p className="text-muted-foreground mb-6">This service may have been removed or is no longer available.</p>
          <Link to="/browse"><Button>Browse Services</Button></Link>
        </main>
      </div>
    );
  }

  const CatIcon = getCategoryIcon(service.category_icon || "");
  const isFav = isFavorite(service.vendor_id);

  const priceDisplay = () => {
    if (!service.price_min) return "Contact for pricing";
    const suffix = service.price_type === "hourly" ? "/hr" : service.price_type === "project" ? " (project)" : "";
    if (service.price_max && service.price_max !== service.price_min) {
      return `$${service.price_min} – $${service.price_max}${suffix}`;
    }
    return `$${service.price_min}${suffix}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${service.title} by ${vendor.display_name}`}
        description={service.description || `Professional ${service.title} service by ${vendor.display_name}`}
        canonical={`/service/${service.id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.title,
          description: service.description || `Professional ${service.title} service`,
          category: service.category_name,
          provider: {
            "@type": "LocalBusiness",
            name: vendor.display_name,
            address: vendor.address || undefined,
            telephone: vendor.phone || undefined,
            image: vendor.avatar_url || undefined,
          },
          areaServed: vendor.address || undefined,
          offers: service.price_min ? {
            "@type": "Offer",
            price: service.price_min,
            priceCurrency: "USD",
            url: `/service/${service.id}`,
          } : undefined,
          aggregateRating: reviews.length > 0 ? {
            "@type": "AggregateRating",
            ratingValue: avgRating,
            reviewCount: reviews.length,
          } : undefined,
        }}
      />
      <UnifiedHeader />

      <PageHeroBanner
        icon={CatIcon}
        title={service.title}
        description={service.description || `Professional ${service.category_name} service`}
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Browse", to: "/browse" },
          { label: service.category_name, to: `/browse?category=${encodeURIComponent(service.category_name)}` },
          { label: service.title },
        ]}
        stats={[
          { icon: Star, value: avgRating > 0 ? avgRating : "New", label: `${reviews.length} review${reviews.length !== 1 ? "s" : ""}` },
          { icon: DollarSign, value: priceDisplay(), label: service.price_type },
          { icon: CheckCircle, value: completedJobs, label: "jobs completed" },
        ]}
      />

      <main className="pb-16">
        <div className="container-app max-w-4xl pt-8">
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
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-card rounded-sm border border-border/60 p-6 animate-reveal">
                <Heading level={2}  className="uppercase mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Service Details
                </Heading>
                <div className="bg-primary/5 border border-primary/15 rounded-sm p-4 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-fs-2xl font-bold text-heading">{priceDisplay()}</p>
                      <p className="text-fs-xs text-muted-foreground capitalize">{service.price_type} pricing</p>
                    </div>
                    <Badge variant="outline" className="gap-1 text-fs-xs">
                      <CatIcon className="w-3 h-3" />
                      {service.category_name}
                    </Badge>
                    <SponsoredBadge
                      isSponsored={service.is_sponsored}
                      sponsoredUntil={service.sponsored_until}
                      size="md"
                      className="ml-2"
                    />
                  </div>
                </div>
                {service.description && (
                  <div className="mb-5">
                    <Heading level={3}  className="text-muted-foreground uppercase mb-2">About this service</Heading>
                    <p className="text-fs-sm text-body leading-relaxed">{service.description}</p>
                  </div>
                )}
                {service.subcategory_name && (
                  <div className="flex items-center gap-2">
                    <span className="text-fs-xs text-muted-foreground">Specialization:</span>
                    <Badge variant="secondary" className="text-fs-xs">{service.subcategory_name}</Badge>
                  </div>
                )}
              </section>

              {availability.length > 0 && (
                <section className="bg-card rounded-sm border border-border/60 p-6 animate-reveal" style={{ animationDelay: "60ms" }}>
                  <Heading level={2}  className="uppercase mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Weekly Availability
                  </Heading>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_NAMES.map((day, i) => {
                      const slot = availability.find((a) => a.day_of_week === i);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "text-center rounded-lg p-2.5 transition-colors",
                            slot
                              ? "bg-emerald-500/8 border border-emerald-500/20"
                              : "bg-muted/40 border border-border/30"
                          )}
                        >
                          <p className={cn("text-[10px] font-bold uppercase mb-1", slot ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{day}</p>
                          {slot ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Off</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="bg-card rounded-sm border border-border/60 p-6 animate-reveal" style={{ animationDelay: "120ms" }}>
                <Heading level={2}  className="uppercase mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" /> Reviews ({reviews.length})
                </Heading>
                {reviews.length === 0 ? (
                  <p className="text-fs-sm text-muted-foreground py-6 text-center">No reviews yet for this provider.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/40">
                      <div className="text-center">
                        <p className="text-fs-3xl font-bold text-heading">{avgRating}</p>
                        <div className="mt-1">
                          <StarRating value={avgRating} size="sm" allowHalf={false} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = reviews.filter((r) => r.rating === star).length;
                          const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                          return (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-muted-foreground w-3">{star}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {pageItems.map((r) => (
                      <div key={r.id} className="pb-4 border-b border-border/30 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/8 flex items-center justify-center text-fs-xs font-bold text-primary shrink-0">
                            {r.customer_avatar ? (
                              <img src={r.customer_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              r.customer_name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-fs-sm font-semibold text-heading">{r.customer_name}</span>
                              <StarRating value={r.rating} size="xs" allowHalf={false} />
                              <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                            </div>
                            {r.comment && <p className="text-fs-xs text-body leading-relaxed">{r.comment}</p>}
                            {r.vendor_reply && (
                              <div className="mt-2 ml-4 pl-3 border-l-2 border-primary/20">
                                <p className="text-[10px] font-semibold text-primary mb-0.5">Provider reply</p>
                                <p className="text-fs-xs text-body">{r.vendor_reply}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
              </section>

              {relatedServices.length > 0 && (
                <section className="bg-card rounded-sm border border-border/60 p-6 animate-reveal" style={{ animationDelay: "180ms" }}>
                  <Heading level={2}  className="uppercase mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Similar Services
                  </Heading>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {relatedServices.map((rs) => (
                      <Link
                        key={rs.id}
                        to={`/service/${rs.id}`}
                        className="group flex items-start gap-3 p-3 rounded-sm border border-border/40 hover:border-primary/25 hover:bg-primary/3 transition-all"
                      >
                        <div className="shrink-0">
                          {rs.vendor_avatar ? (
                            <img src={rs.vendor_avatar} alt={rs.vendor_name} className="w-9 h-9 rounded-lg object-cover ring-1 ring-border/40" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center text-fs-xs font-bold text-primary ring-1 ring-primary/10">
                              {rs.vendor_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-fs-sm font-semibold text-heading truncate group-hover:text-primary transition-colors">{rs.title}</p>
                          <p className="text-[13px] text-muted-foreground truncate">{rs.vendor_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {rs.avg_rating > 0 && (
                              <div className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-primary text-primary" />
                                <span className="text-[10px] font-bold text-heading tabular-nums">{rs.avg_rating}</span>
                                <span className="text-[10px] text-muted-foreground">({rs.review_count})</span>
                              </div>
                            )}
                            {rs.price_min && (
                              <span className="text-[10px] font-semibold text-heading tabular-nums">
                                ${rs.price_min}{rs.price_type === "hourly" ? "/hr" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-5">
              <div className="bg-card rounded-sm border border-border/60 p-5 sticky top-24 animate-reveal">
                <div className="flex items-center gap-3 mb-4">
                  <Link to={`/provider/${service.vendor_id}`} className="shrink-0">
                    {vendor.avatar_url ? (
                      <img src={vendor.avatar_url} alt={vendor.display_name} className="w-14 h-14 rounded-sm object-cover ring-1 ring-border/40" />
                    ) : (
                      <div className="w-14 h-14 rounded-sm bg-primary/8 flex items-center justify-center text-fs-lg font-bold text-primary ring-1 ring-primary/10">
                        {vendor.display_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link to={`/provider/${service.vendor_id}`} className="text-fs-sm font-semibold text-heading truncate hover:text-primary transition-colors">
                        {vendor.display_name}
                      </Link>
                      <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                    </div>
                    {vendor.plan_name && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 h-[18px] font-bold gap-0.5 mt-0.5",
                          vendor.plan_name === "Elite"
                            ? "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                            : "border-primary/30 bg-primary/5 text-primary"
                        )}
                      >
                        {vendor.plan_name === "Elite" ? <Crown className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                        {vendor.plan_name}
                      </Badge>
                    )}
                    {vendor.address && (
                      <p className="text-[13px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {vendor.address}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFavorite(service.vendor_id)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors active:scale-95"
                  >
                    <Heart className={cn("w-4 h-4", isFav ? "fill-destructive text-destructive" : "text-muted-foreground/50")} />
                  </button>
                  <ReportButton entityType="service" entityId={service.id} size="icon" />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="text-fs-sm font-bold text-heading tabular-nums">{avgRating || "—"}</p>
                    <p className="text-[9px] text-muted-foreground">Rating</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="text-fs-sm font-bold text-heading tabular-nums">{reviews.length}</p>
                    <p className="text-[9px] text-muted-foreground">Reviews</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="text-fs-sm font-bold text-heading tabular-nums">{completedJobs}</p>
                    <p className="text-[9px] text-muted-foreground">Jobs</p>
                  </div>
                </div>

                <p className="text-[13px] text-muted-foreground flex items-center gap-1 mb-4">
                  <Calendar className="w-3 h-3" /> Member since {format(new Date(vendor.created_at), "MMM yyyy")}
                </p>

                <div className="space-y-2">
                  {cannotBook ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block">
                            <Button disabled className="w-full gap-2 pointer-events-auto cursor-not-allowed" size="lg">
                              <Lock className="w-4 h-4" /> Book Now
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Booking requires a customer account</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      onClick={() => navigate(`/book?category=${service.category_id}&provider=${service.vendor_id}`)}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <Calendar className="w-4 h-4" /> Book Now
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </Button>
                  )}
                  {cannotBook ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block">
                            <Button variant="outline" disabled className="w-full gap-2 pointer-events-auto cursor-not-allowed">
                              <Lock className="w-4 h-4" /> Send Message
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Messaging requires a customer account</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => navigate(`/chat?with=${service.vendor_id}`)}
                    >
                      <MessageSquare className="w-4 h-4" /> Send Message
                    </Button>
                  )}
                  <Link to={`/provider/${service.vendor_id}`} className="block">
                    <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                      <User className="w-4 h-4" /> View Full Profile
                    </Button>
                  </Link>
                </div>
              </div>

              {otherServices.length > 0 && (
                <div className="bg-card rounded-sm border border-border/60 p-5 animate-reveal" style={{ animationDelay: "60ms" }}>
                  <Heading level={3}  className="uppercase mb-3">
                    More by {vendor.display_name}
                  </Heading>
                  <div className="space-y-2">
                    {otherServices.map((s) => (
                      <Link
                        key={s.id}
                        to={`/service/${s.id}`}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                      >
                        <span className="text-fs-sm text-body group-hover:text-foreground transition-colors truncate">{s.title}</span>
                        {s.price_min && (
                          <span className="text-fs-xs font-semibold text-heading tabular-nums shrink-0 ml-2">
                            ${s.price_min}{s.price_type === "hourly" ? "/hr" : ""}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
