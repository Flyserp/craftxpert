import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Star, MapPin, Search, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState } from "@/components/ui/app";

interface SavedVendor {
  vendor_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  address: string | null;
  avg_rating: number;
  review_count: number;
  service_count: number;
}

export default function SavedProvidersPage() {
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [vendors, setVendors] = useState<SavedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(vendors, 12);

  useEffect(() => {
    if (!user || favoriteIds.size === 0) {
      setVendors([]);
      setLoading(false);
      return;
    }

    const fetchSavedVendors = async () => {
      setLoading(true);
      const ids = Array.from(favoriteIds);

      const [profilesRes, reviewsRes, servicesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, bio, address").in("user_id", ids),
        supabase.from("reviews").select("vendor_id, rating").in("vendor_id", ids),
        supabase.from("vendor_services").select("vendor_id").eq("is_active", true).in("vendor_id", ids),
      ]);

      const reviewMap: Record<string, { total: number; count: number }> = {};
      for (const r of reviewsRes.data || []) {
        if (!reviewMap[r.vendor_id]) reviewMap[r.vendor_id] = { total: 0, count: 0 };
        reviewMap[r.vendor_id].total += r.rating;
        reviewMap[r.vendor_id].count += 1;
      }

      const serviceCountMap: Record<string, number> = {};
      for (const s of servicesRes.data || []) {
        serviceCountMap[s.vendor_id] = (serviceCountMap[s.vendor_id] || 0) + 1;
      }

      const result: SavedVendor[] = (profilesRes.data || []).map((p) => ({
        vendor_id: p.user_id,
        display_name: p.display_name || "Provider",
        avatar_url: p.avatar_url,
        bio: p.bio,
        address: p.address,
        avg_rating: reviewMap[p.user_id] ? reviewMap[p.user_id].total / reviewMap[p.user_id].count : 0,
        review_count: reviewMap[p.user_id]?.count || 0,
        service_count: serviceCountMap[p.user_id] || 0,
      }));

      setVendors(result);
      setLoading(false);
    };

    fetchSavedVendors();
  }, [user, favoriteIds]);

  return (
    <DashboardLayout title="Saved Providers" subtitle="Providers you've bookmarked for later.">
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-sm border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No saved providers yet"
          description="Browse services and tap the heart icon to save vendors you're interested in."
          actionLabel="Browse Providers"
          actionHref="/browse"
        />
      ) : (
        <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((v, i) => (
            <div
              key={v.vendor_id}
              className="group bg-card rounded-sm border border-border p-5 transition-colors animate-reveal"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3 mb-3">
                {v.avatar_url ? (
                  <img
                    src={v.avatar_url}
                    alt={v.display_name}
                    className="w-12 h-12 rounded-full object-cover ring-1 ring-border/40"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-fs-sm font-bold text-primary shrink-0">
                    {v.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-fs-sm font-semibold text-heading truncate">{v.display_name}</p>
                  {v.address && (
                    <p className="text-fs-xs text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {v.address}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleFavorite(v.vendor_id)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors active:scale-95"
                  aria-label="Remove from saved"
                >
                  <Heart className="w-4 h-4 text-destructive fill-destructive" />
                </button>
              </div>

              {v.bio && (
                <p className="text-fs-xs text-muted-foreground line-clamp-2 mb-3">{v.bio}</p>
              )}

              <div className="flex items-center gap-3 text-fs-xs text-muted-foreground mb-4">
                {v.review_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-medium text-heading tabular-nums">
                      {v.avg_rating.toFixed(1)}
                    </span>
                    ({v.review_count})
                  </span>
                )}
                <span>{v.service_count} service{v.service_count !== 1 ? "s" : ""}</span>
              </div>

              <div className="flex gap-2">
                <Link to={`/provider/${v.vendor_id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-1.5">
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Link to={`/book?provider=${v.vendor_id}`} className="flex-1">
                  <Button size="sm" className="w-full gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Quick Hire
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
        <NumberedPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
        </>
      )}
    </DashboardLayout>
  );
}
