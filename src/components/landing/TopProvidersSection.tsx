import { useEffect, useState } from "react";
import { MapPin, CheckCircle, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { supabase } from "@/integrations/supabase/client";
import { RatingBadge } from "@/components/reviews/RatingBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading } from "@/components/ui/app";

interface TopProvider {
  id: string;
  name: string;
  avatar_url: string | null;
  address: string | null;
  avg_rating: number;
  review_count: number;
}

const MIN_REVIEWS_FOR_TOP = 1; // show pros with at least one verified review
const TOP_LIMIT = 6;

const TopProvidersSection = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-provider]", staggerDelay: 100 });
  const [providers, setProviders] = useState<TopProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Pull all reviews (vendor_id, rating) and aggregate client-side. Reviews are
      // small enough at this stage; we cap the final list at TOP_LIMIT.
      const { data: reviews } = await supabase
        .from("reviews")
        .select("vendor_id, rating");

      if (cancelled) return;
      const agg: Record<string, { sum: number; count: number }> = {};
      (reviews || []).forEach((r: any) => {
        if (!r?.vendor_id) return;
        if (!agg[r.vendor_id]) agg[r.vendor_id] = { sum: 0, count: 0 };
        agg[r.vendor_id].sum += r.rating;
        agg[r.vendor_id].count += 1;
      });

      const ranked = Object.entries(agg)
        .filter(([, v]) => v.count >= MIN_REVIEWS_FOR_TOP)
        .map(([vendor_id, v]) => ({
          vendor_id,
          avg: v.sum / v.count,
          count: v.count,
        }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count)
        .slice(0, TOP_LIMIT);

      if (ranked.length === 0) {
        if (!cancelled) {
          setProviders([]);
          setLoading(false);
        }
        return;
      }

      const ids = ranked.map((r) => r.vendor_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, address")
        .in("user_id", ids);

      if (cancelled) return;
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const list: TopProvider[] = ranked
        .map((r) => {
          const p = profMap.get(r.vendor_id);
          if (!p) return null;
          return {
            id: r.vendor_id,
            name: p.display_name || "Pro",
            avatar_url: p.avatar_url,
            address: p.address,
            avg_rating: Math.round(r.avg * 10) / 10,
            review_count: r.count,
          };
        })
        .filter(Boolean) as TopProvider[];

      setProviders(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the section entirely if there's nothing real to show — avoids
  // a misleading empty placeholder on a fresh deployment.
  if (!loading && providers.length === 0) return null;

  return (
    <section id="providers" className="py-24 md:py-32 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)), transparent 70%)" }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-14" ref={headerRef}>
          <p className="text-eyebrow mb-3">Popular Providers</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Meet our <span className="text-accent">Top-rated</span> Professionals
          </Heading>
          <p className="text-lead">
            Ranked by verified customer reviews from completed jobs.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" ref={gridRef}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-sm border border-border p-6 flex flex-col items-center"
                >
                  <Skeleton className="w-20 h-20 rounded-full mb-4" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24 mb-3" />
                  <Skeleton className="h-3 w-20 mb-4" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))
            : providers.map((p) => (
                <Link
                  to={`/provider/${p.id}`}
                  key={p.id}
                  data-provider
                  className="group bg-card rounded-sm border border-border overflow-hidden hover:border-primary/20 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.name}
                          className="w-20 h-20 rounded-full object-cover ring-3 ring-primary/20 group-hover:ring-primary/50 transition-all"
                          loading="lazy"
                          width={80}
                          height={80}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-muted ring-3 ring-primary/20 flex items-center justify-center text-fs-xl font-semibold text-heading">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <Heading level={3}  className="group-hover:text-primary transition-colors">
                        {p.name}
                      </Heading>
                      <CheckCircle className="w-4 h-4 text-primary" aria-label="Verified" />
                    </div>

                    {/* Star strip + numeric rating */}
                    <div className="flex items-center gap-1 mb-1 mt-1" aria-hidden="true">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.round(p.avg_rating)
                              ? "text-primary fill-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mb-3">
                      <RatingBadge
                        rating={p.avg_rating}
                        reviewCount={p.review_count}
                        size="sm"
                      />
                    </div>

                    {p.address && (
                      <div className="flex items-center gap-1 text-fs-xs text-muted-foreground mb-4">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="line-clamp-1">{p.address}</span>
                      </div>
                    )}

                    <Button size="sm" variant="default" className="w-full px-4">
                      View Profile
                    </Button>
                  </div>
                </Link>
              ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/browse">
            <Button variant="outline" size="lg" className="gap-2 group h-12 px-4">
              Browse All Professionals
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default TopProvidersSection;
