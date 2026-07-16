import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Heading } from "@/components/ui/app";

interface RecentService {
  id: string;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  vendor_id: string;
  created_at: string;
  vendor_name?: string;
}

const RecentServicesSection = () => {
  const headerRef = useScrollReveal();
  const [items, setItems] = useState<RecentService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vendor_services")
        .select("id, title, description, price_min, price_max, vendor_id, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (cancelled) return;
      const list = (data || []) as RecentService[];
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
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        <div ref={headerRef} className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-eyebrow mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Just added
            </div>
            <Heading level={2} >Recently added services</Heading>
            <p className="text-description-sm mt-2">Fresh listings from new and returning providers.</p>
          </div>
          <Button asChild variant="ghost" className="text-accent">
            <Link to="/browse?sort=newest">Explore all <ArrowRight className="ml-1 h-4 w-4" /></Link>
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
                  <Heading level={3}  className="text-subheading line-clamp-1 mb-2">{s.title}</Heading>
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

export default RecentServicesSection;