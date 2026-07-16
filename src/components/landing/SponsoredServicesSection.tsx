import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Heading, SponsoredBadge } from "@/components/ui/app";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface SponsoredService {
  id: string;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  vendor_id: string;
  sponsored_until: string | null;
  vendor_name?: string;
}

const SponsoredServicesSection = () => {
  const headerRef = useScrollReveal();
  const [items, setItems] = useState<SponsoredService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vendor_services")
        .select("id, title, description, price_min, price_max, vendor_id, sponsored_until")
        .eq("is_active", true)
        .eq("is_sponsored", true)
        .or(`sponsored_until.is.null,sponsored_until.gt.${new Date().toISOString()}`)
        .order("sponsored_until", { ascending: false, nullsFirst: false })
        .limit(6);
      if (cancelled) return;
      const list = (data || []) as SponsoredService[];
      const ids = [...new Set(list.map((s) => s.vendor_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        const map = new Map((profs || []).map((p: any) => [p.user_id, p.display_name]));
        list.forEach((s) => (s.vendor_name = map.get(s.vendor_id) || "Verified pro"));
      }
      setItems(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-16 px-4 bg-background">
      <div className="container mx-auto max-w-7xl">
        <div ref={headerRef} className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-eyebrow mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Sponsored
            </div>
            <Heading level={2} >Sponsored services</Heading>
            <p className="text-description-sm mt-2">Promoted by top providers right now.</p>
          </div>
          <Button asChild variant="ghost" className="text-accent">
            <Link to="/browse">Browse all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-sm" />)
            : items.map((s) => (
                <Link
                  key={s.id}
                  to={`/service/${s.id}`}
                  className="border border-border rounded-sm p-5 bg-card transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Heading level={3}  className="text-subheading line-clamp-1">{s.title}</Heading>
                    <SponsoredBadge isSponsored sponsoredUntil={s.sponsored_until ?? undefined} />
                  </div>
                  <p className="text-description-sm line-clamp-2 mb-4">{s.description || "—"}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate">{s.vendor_name}</span>
                    {s.price_min != null && (
                      <span className="font-semibold text-foreground">
                        ${s.price_min}{s.price_max && s.price_max !== s.price_min ? `–$${s.price_max}` : ""}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
};

export default SponsoredServicesSection;