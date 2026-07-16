import { useEffect, useState, useMemo, useCallback } from "react";
import { Star, ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { supabase } from "@/integrations/supabase/client";
import { getCategories } from "@/lib/taxonomyCache";

import plumbingImg from "@/assets/services/plumbing.jpg";
import cleaningImg from "@/assets/services/cleaning.jpg";
import paintingImg from "@/assets/services/painting.jpg";
import electricalImg from "@/assets/services/electrical.jpg";
import carpentryImg from "@/assets/services/carpentry.jpg";
import landscapingImg from "@/assets/services/landscaping.jpg";
import { Heading } from "@/components/ui/app";

const IMAGE_MAP: Record<string, string> = {
  plumbing: plumbingImg,
  cleaning: cleaningImg,
  painting: paintingImg,
  electrical: electricalImg,
  carpentry: carpentryImg,
  landscaping: landscapingImg,
};

function getCategoryImage(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [key, img] of Object.entries(IMAGE_MAP)) {
    if (lower.includes(key)) return img;
  }
  const imgs = Object.values(IMAGE_MAP);
  const hash = categoryName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return imgs[hash % imgs.length];
}

interface FeaturedService {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_type: string;
  vendor_name: string;
  avatar_url: string | null;
  category_name: string;
  avg_rating: number;
  review_count: number;
}

const ALL_TAB = "All";

const FeaturedServicesSection = () => {
  const navigate = useNavigate();
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-service]", staggerDelay: 100 });
  const [allServices, setAllServices] = useState<FeaturedService[]>([]);
  const [allCategoryNames, setAllCategoryNames] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [animKey, setAnimKey] = useState(0);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setAnimKey((k) => k + 1);
  }, [activeTab]);

  useEffect(() => {
    const fetchServices = async () => {
      const [catsList, servicesData, countsRes] = await Promise.all([
        getCategories(),
        supabase
          .from("vendor_services")
          .select("id, title, description, price_min, price_max, price_type, vendor_id, category_id")
          .eq("is_active", true)
          .limit(200),
        supabase
          .from("vendor_services")
          .select("category_id")
          .eq("is_active", true),
      ]);

      setAllCategoryNames(catsList.map((c) => c.name));

      const catsMap = Object.fromEntries(catsList.map((c) => [c.id, c.name]));
      const countsByName: Record<string, number> = {};
      (countsRes.data || []).forEach((row: any) => {
        const name = catsMap[row.category_id];
        if (!name) return;
        countsByName[name] = (countsByName[name] || 0) + 1;
      });
      setCategoryCounts(countsByName);
      setTotalCount((countsRes.data || []).length);


      const services = servicesData.data || [];
      if (services.length === 0) return;

      const providerIds = [...new Set(services.map((s) => s.vendor_id as string))];




      const [profilesRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", providerIds),
        supabase.from("reviews").select("vendor_id, rating").in("vendor_id", providerIds),
      ]);

      const profilesMap = Object.fromEntries(
        (profilesRes.data || []).map((p) => [p.user_id, p])
      );

      const ratingsMap: Record<string, { sum: number; count: number }> = {};
      (reviewsRes.data || []).forEach((r: any) => {
        if (!ratingsMap[r.vendor_id]) ratingsMap[r.vendor_id] = { sum: 0, count: 0 };
        ratingsMap[r.vendor_id].sum += r.rating;
        ratingsMap[r.vendor_id].count += 1;
      });

      const enriched: FeaturedService[] = services.map((s) => {
        const profile = profilesMap[s.vendor_id];
        const ratings = ratingsMap[s.vendor_id];
        return {
          id: s.id,
          vendor_id: s.vendor_id,
          title: s.title,
          description: s.description,
          price_min: s.price_min,
          price_max: s.price_max,
          price_type: s.price_type,
          vendor_name: profile?.display_name || "Pro",
          avatar_url: profile?.avatar_url || null,
          category_name: catsMap[s.category_id] || "Service",
          avg_rating: ratings ? Math.round((ratings.sum / ratings.count) * 10) / 10 : 0,
          review_count: ratings?.count || 0,
        };
      });

      enriched.sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
      const filtered = enriched.filter((s) => s.title.length < 60);
      setAllServices(filtered);
    };

    fetchServices();
  }, []);

  // Category tabs strictly follow the service_categories catalog order
  // (admin-defined sort_order, then name). We do NOT derive or append
  // categories from the sampled services — that would introduce arbitrary
  // fetch-order tabs that ignore admin ordering.
  const categories = useMemo(
    () => [ALL_TAB, ...allCategoryNames],
    [allCategoryNames],
  );



  // Filter services by active tab, show up to 6
  const services = useMemo(() => {
    const filtered = activeTab === ALL_TAB
      ? allServices
      : allServices.filter((s) => s.category_name === activeTab);
    return filtered.slice(0, 6);
  }, [allServices, activeTab]);

  const formatPrice = (s: FeaturedService) => {
    if (s.price_min && s.price_max) return `$${s.price_min} – $${s.price_max}`;
    if (s.price_min) return `From $${s.price_min}`;
    if (s.price_max) return `Up to $${s.price_max}`;
    return "Get Quote";
  };

  if (allServices.length === 0) return null;

  return (
    <section className="py-24 md:py-32 surface-warm relative overflow-hidden">
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-10" ref={headerRef}>
          <p className="text-eyebrow mb-3">
            Featured Services
          </p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Our <span className="text-accent">Featured</span> Services
          </Heading>
          <p className="text-lead">
            Each listing is designed to be clear and concise, providing customers with essential
            information at a glance.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
          {categories.map((cat) => {
            const isActive = activeTab === cat;
            const count = cat === ALL_TAB ? totalCount : (categoryCounts[cat] || 0);
            return (
              <button
                key={cat}
                onClick={() => handleTabChange(cat)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-fs-sm font-medium transition-all duration-200 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-body border-border/60 hover:border-primary/40 hover:text-primary"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div key={animKey} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" ref={gridRef}>
          {services.map((s, i) => (
            <div
              key={s.id}
              data-service
              onClick={() => navigate(`/provider/${s.vendor_id}`)}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              className="group bg-card rounded-sm border border-border overflow-hidden hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={getCategoryImage(s.category_name)}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  width={704}
                  height={512}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <span className="absolute top-3 left-3 bg-primary/90 text-primary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {s.category_name}
                </span>
 <Button
   type="button"
   variant="ghost"
   size="icon-sm"
   aria-label="Save to favorites"
   onClick={(e) => e.stopPropagation()}
   className="absolute top-3 right-3 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background group/heart"
 >
   <Heart className="w-4 h-4 text-muted-foreground group-hover/heart:text-destructive transition-colors" />
 </Button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="text-fs-sm font-semibold text-heading tabular-nums">
                      {s.avg_rating > 0 ? s.avg_rating : "New"}
                    </span>
                  </div>
                  {s.review_count > 0 && (
                    <span className="text-fs-xs text-muted-foreground">
                      ({s.review_count} review{s.review_count !== 1 ? "s" : ""})
                    </span>
                  )}
                </div>

                <Heading level={3}  className="mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {s.title}
                </Heading>

                {s.description && (
                  <p className="text-description-sm line-clamp-2 mb-3">
                    {s.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {s.vendor_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <span className="text-fs-xs text-muted-foreground truncate max-w-[100px]">
                      {s.vendor_name}
                    </span>
                  </div>
                  <span className="text-fs-sm font-bold text-primary tabular-nums">
                    {formatPrice(s)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 group h-12 px-4"
            onClick={() => navigate("/browse")}
          >
            View All Services
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedServicesSection;
