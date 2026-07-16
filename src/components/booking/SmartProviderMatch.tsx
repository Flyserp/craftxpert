import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Star, Clock, MapPin, TrendingUp, ChevronRight, Loader2, CheckCircle2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MatchedVendor {
  vendor_id: string;
  display_name: string;
  address: string | null;
  bio: string | null;
  avg_rating: number;
  review_count: number;
  available_slots: number;
  bookings_30d: number;
  completion_rate?: number;
  score: number;
  services: {
    id: string;
    vendor_id: string;
    title: string;
    price_min: number | null;
    price_max: number | null;
    price_type: string;
  }[];
}

interface SmartProviderMatchProps {
  categoryId: string;
  customerAddress?: string;
  tenantId?: string;
  onSelectVendor: (vendor: MatchedVendor) => void;
  brandColor?: string;
}

export default function SmartProviderMatch({
  categoryId,
  customerAddress,
  tenantId,
  onSelectVendor,
  brandColor,
}: SmartProviderMatchProps) {
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState("");
  const [vendors, setVendors] = useState<MatchedVendor[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!categoryId) return;
    setLoading(true);
    setError("");

    const fetchMatch = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "smart-match-vendor",
          {
            body: { categoryId, customerAddress, tenantId },
          }
        );

        if (fnError) throw fnError;
        setRecommendation(data?.recommendation || "");
        setVendors(data?.vendors || []);
      } catch (e) {
        console.error("Smart match error:", e);
        setError("Could not load recommendations.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [categoryId, customerAddress, tenantId]);

  if (loading) {
    return (
      <div className="bg-card rounded-sm border border-border p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-fs-sm font-semibold text-heading">AI Smart Match</p>
            <p className="text-fs-xs text-muted-foreground">Analyzing providers for you…</p>
          </div>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded-full w-4/5" />
          <div className="h-4 bg-muted rounded-full w-3/5" />
          <div className="h-20 bg-muted rounded-sm mt-4" />
        </div>
      </div>
    );
  }

  if (error || vendors.length === 0) {
    return null;
  }

  const topVendor = vendors[0];
  const accentColor = brandColor || "hsl(var(--primary))";

  return (
    <div className="space-y-4 animate-reveal">
      {/* AI Recommendation Card */}
      {recommendation && (
        <div
          className="relative overflow-hidden rounded-sm border p-5"
          style={{
            borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
            background: `color-mix(in srgb, ${accentColor} 4%, var(--card))`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
            >
              <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-fs-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: accentColor }}>
                AI Smart Recommendation
              </p>
              <p className="text-fs-sm text-body leading-relaxed">
                {recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Match */}
      <button
        onClick={() => onSelectVendor(topVendor)}
        className={cn(
          "w-full text-left rounded-sm border-2 p-5 transition-all duration-300",
          "active:scale-[0.99]"
        )}
        style={{
          borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`,
          boxShadow: `0 4px 24px color-mix(in srgb, ${accentColor} 10%, transparent)`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
              color: accentColor,
            }}
          >
            <Zap className="w-3 h-3" />
            Best Match
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums font-semibold">
            {topVendor.score}% match
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div
            className="w-13 h-13 rounded-sm flex items-center justify-center text-fs-sm font-bold text-white shrink-0"
            style={{ backgroundColor: accentColor, width: "3.25rem", height: "3.25rem" }}
          >
            {(topVendor.display_name || "V").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-fs-sm font-semibold text-heading mb-1">
              {topVendor.display_name}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fs-xs text-muted-foreground">
              {topVendor.avg_rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-heading tabular-nums">{topVendor.avg_rating}</span>
                  <span>({topVendor.review_count})</span>
                </span>
              )}
              {topVendor.available_slots > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{topVendor.available_slots} slots</span>
                </span>
              )}
              {topVendor.completion_rate != null && topVendor.completion_rate > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                  <span className="tabular-nums">{topVendor.completion_rate}% completed</span>
                </span>
              )}
              {topVendor.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{topVendor.address}</span>
                </span>
              )}
              {topVendor.bookings_30d > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {topVendor.bookings_30d} recent
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {topVendor.services.map((s) => (
                <span
                  key={s.id}
                  className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
                >
                  {s.title}
                  {s.price_min ? ` · $${s.price_min}` : ""}
                  {s.price_type === "hourly" ? "/hr" : ""}
                </span>
              ))}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-4" />
        </div>
      </button>

      {/* Other options */}
      {vendors.length > 1 && (
        <div>
          <p className="text-fs-xs font-medium text-muted-foreground mb-2.5">
            Other recommended options
          </p>
          <div className="space-y-2">
            {vendors.slice(1, 4).map((v) => (
              <button
                key={v.vendor_id}
                onClick={() => onSelectVendor(v)}
                className="w-full text-left p-4 rounded-sm border border-border bg-card hover:border-primary/30 transition-all duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-fs-xs font-bold text-muted-foreground shrink-0">
                    {(v.display_name || "V").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fs-sm font-medium text-heading">
                      {v.display_name}
                    </p>
                    <div className="flex items-center gap-3 text-fs-xs text-muted-foreground mt-0.5">
                      {v.avg_rating > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {v.avg_rating}
                        </span>
                      )}
                      {v.available_slots > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <Clock className="w-3 h-3" />
                          {v.available_slots} slots
                        </span>
                      )}
                      <span className="tabular-nums font-medium">{v.score}%</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
