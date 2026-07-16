import { Link } from "react-router-dom";
import { Star, Sparkles, MapPin, BadgeCheck } from "lucide-react";
import type { ProviderCardData } from "./types";
import { Heading } from "@/components/ui/app";

interface Props {
  vendors: ProviderCardData[];
}

export default function FeaturedProvidersRow({ vendors }: Props) {
  const featured = [...vendors]
    .filter((v) => v.is_featured || v.is_sponsored || v.review_count > 0 || v.plan_name)
    .sort((a, b) => {
      if (!!b.is_featured !== !!a.is_featured) return b.is_featured ? 1 : -1;
      if (!!b.is_sponsored !== !!a.is_sponsored) return b.is_sponsored ? 1 : -1;
      const planRank = (p: string | null) => (p === "Elite" ? 2 : p === "Pro" ? 1 : 0);
      const diff = planRank(b.plan_name) - planRank(a.plan_name);
      if (diff !== 0) return diff;
      return b.avg_rating * 10 + b.bookings_30d - (a.avg_rating * 10 + a.bookings_30d);
    })
    .slice(0, 4);

  if (featured.length === 0) return null;

  return (
    <section className="mb-6 animate-reveal">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <Heading level={2}  className="uppercase">Featured Pros</Heading>
        <span className="text-[10px] text-muted-foreground font-medium">Sponsored</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {featured.map((v) => (
          <Link
            key={v.vendor_id}
            to={`/provider/${v.vendor_id}`}
            className="group relative bg-card border border-border rounded-sm p-3 transition-all hover:border-primary/40 overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-gradient-to-bl from-primary/10 to-transparent w-16 h-16 pointer-events-none" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-sm bg-primary/10 overflow-hidden shrink-0 ring-2 ring-primary/20">
                {v.avatar_url ? (
                  <img src={v.avatar_url} alt={v.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-fs-sm font-bold text-primary">
                    {v.display_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-fs-sm font-semibold text-heading truncate group-hover:text-primary transition-colors">
                    {v.display_name}
                  </p>
                  <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                </div>
                <p className="text-[13px] text-muted-foreground truncate">{v.categories[0] || "Service Pro"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Star className="w-3 h-3 fill-current" />
                {v.avg_rating > 0 ? v.avg_rating.toFixed(1) : "New"}
                {v.review_count > 0 && (
                  <span className="text-muted-foreground font-normal">({v.review_count})</span>
                )}
              </span>
              {v.address && (
                <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[60%]">
                  <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{v.address.split(",")[0]}</span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
