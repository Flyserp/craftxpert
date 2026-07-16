import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Star, MapPin, Clock, TrendingUp, ArrowRight, Heart, Crown, Zap, ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import VerificationBadge from "@/components/provider/VerificationBadge";
import type { ProviderCardData } from "./types";
import type { NearestSlot } from "@/hooks/useNearestVendorSlots";
import UrgencyBadge from "./UrgencyBadge";
import { Heading, SponsoredBadge } from "@/components/ui/app";

interface ProviderListCardProps {
  vendor: ProviderCardData;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (providerId: string) => void;
  /** Soonest available slot — shown as an urgency badge when present (emergency mode). */
  nearestSlot?: NearestSlot;
}

const ProviderListCard = ({ vendor: v, index, isFavorite: isFav, onToggleFavorite, nearestSlot }: ProviderListCardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, roles } = useAuth();
  const cannotBook = !!user && roles.length > 0 && !roles.includes("customer");
  const prices = v.services.map((s) => s.price_min).filter(Boolean) as number[];
  const minPrice = prices.length ? Math.min(...prices) : null;
  const isAvailable = v.available_slots > 0;

  const handleSubcategoryClick = (subName: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("subcategory", subName);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <article
      className="group bg-card rounded-sm border border-border/60 overflow-hidden transition-all duration-200 hover:border-primary/25 animate-reveal"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
        {/* Avatar + identity */}
        <div className="flex items-center gap-3 min-w-0 sm:w-64 shrink-0">
          <div className="relative shrink-0">
            {v.avatar_url ? (
              <img src={v.avatar_url} alt={v.display_name} className="w-11 h-11 rounded-sm object-cover ring-1 ring-border/40" />
            ) : (
              <div className="w-11 h-11 rounded-sm bg-primary/8 flex items-center justify-center text-fs-sm font-bold text-primary ring-1 ring-primary/10">
                {v.display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isAvailable && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Heading level={3}  className="truncate">{v.display_name}</Heading>
              <VerificationBadge vendorId={v.vendor_id} />
              <SponsoredBadge isSponsored={v.is_sponsored} sponsoredUntil={v.sponsored_until} />
              {v.plan_name && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-[18px] font-bold gap-0.5 shrink-0",
                    v.plan_name === "Elite"
                      ? "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/30"
                      : "border-primary/30 bg-primary/5 text-primary"
                  )}
                >
                  {v.plan_name === "Elite" ? <Crown className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                  {v.plan_name}
                </Badge>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground truncate">{v.categories.join(" · ")}</p>
            {v.address && (
              <p className="text-[13px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />{v.address}
              </p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-sm">
            <Star className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[13px] font-bold tabular-nums text-heading">{v.avg_rating > 0 ? v.avg_rating : "New"}</span>
            {v.review_count > 0 && <span className="text-[10px] text-muted-foreground">({v.review_count})</span>}
          </div>
          {minPrice != null && (
            <div className="flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded-sm">
              <span className="text-[13px] font-semibold text-heading tabular-nums">${minPrice}</span>
              <span className="text-[10px] text-muted-foreground">start</span>
            </div>
          )}
          {v.bookings_30d > 2 && (
            <div className="flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded-sm">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-heading">Popular</span>
            </div>
          )}
          <div className={cn(
            "flex items-center gap-1 text-[13px] px-2 py-0.5 rounded-sm",
            isAvailable ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400" : "bg-muted/60 text-muted-foreground"
          )}>
            <Clock className="w-3 h-3 shrink-0" />
            <span className="font-medium">{isAvailable ? `${v.available_slots} slot${v.available_slots !== 1 ? "s" : ""}` : "No slots"}</span>
          </div>
          {nearestSlot && <UrgencyBadge slot={nearestSlot} />}
        </div>


        {/* Service chips */}
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {v.services.slice(0, 3).map((s) => (
            <Link
              key={s.id}
              to={`/service/${s.id}`}
              className="text-[10px] font-medium bg-muted/60 text-body px-2 py-0.5 rounded-full border border-border/30 hover:bg-primary/8 hover:text-primary hover:border-primary/20 transition-colors whitespace-nowrap"
            >
              {s.title}
              {s.price_min ? ` · $${s.price_min}${s.price_type === "hourly" ? "/hr" : ""}` : ""}
            </Link>
          ))}
          {v.services.length > 3 && (
            <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5">+{v.services.length - 3}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); onToggleFavorite(v.vendor_id); }}
            className="inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-muted transition-colors active:scale-95"
            aria-label={isFav ? "Remove from saved" : "Save provider"}
          >
            <Heart className={cn("w-4 h-4 transition-colors", isFav ? "fill-destructive text-destructive" : "text-muted-foreground/60")} />
          </button>
          <Link to={v.services.length > 0 ? `/service/${v.services[0].id}` : `/provider/${v.vendor_id}`}>
            <Button size="sm" variant="ghost" className="text-fs-xs text-muted-foreground hover:text-foreground">Details</Button>
          </Link>
          {cannotBook ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled className="text-fs-xs gap-1 cursor-not-allowed text-primary-foreground">
                      <Lock className="w-3 h-3" /> Book
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Booking requires a customer account</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : v.services.length <= 1 ? (
            <Link to={v.services.length === 1 ? `/book?service=${v.services[0].id}&provider=${v.vendor_id}` : `/book?provider=${v.vendor_id}`}>
              <Button size="sm" className="text-fs-xs gap-1 text-primary-foreground">
                Book <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="text-fs-xs gap-1 text-primary-foreground">
                  {minPrice != null ? `Book from $${minPrice}` : "Book"} <ChevronDown className="w-3 h-3 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {v.services.map((s) => (
                  <DropdownMenuItem key={s.id} asChild>
                    <Link to={`/book?service=${s.id}&provider=${v.vendor_id}`} className="flex justify-between items-center w-full cursor-pointer">
                      <span className="truncate text-fs-xs">{s.title}</span>
                      {s.price_min != null && (
                        <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                          ${s.price_min}{s.price_type === "hourly" ? "/hr" : ""}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProviderListCard;
