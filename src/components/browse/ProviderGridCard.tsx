import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Star, MapPin, Clock, TrendingUp, ArrowRight, Heart, Crown, Zap, ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import VerificationBadge from "@/components/provider/VerificationBadge";
import type { ProviderCardData } from "./types";
import type { NearestSlot } from "@/hooks/useNearestVendorSlots";
import UrgencyBadge from "./UrgencyBadge";
import { Heading, SponsoredBadge } from "@/components/ui/app";

interface ProviderGridCardProps {
  vendor: ProviderCardData;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (providerId: string) => void;
  /** Soonest available slot — shown as an urgency badge when present (emergency mode). */
  nearestSlot?: NearestSlot;
}

const ProviderGridCard = ({ vendor: v, index, isFavorite: isFav, onToggleFavorite, nearestSlot }: ProviderGridCardProps) => {
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
      className="group bg-card rounded-sm border border-border/60 overflow-hidden transition-all duration-200 hover:border-primary/25 animate-reveal flex flex-col"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* Top section */}
      <div className="p-4 pb-0 flex-1">
        {/* Vendor identity */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0">
            {v.avatar_url ? (
              <img
                src={v.avatar_url}
                alt={v.display_name}
                className="w-12 h-12 rounded-sm object-cover ring-1 ring-border/40 group-hover:ring-primary/20 transition-all duration-300"
              />
            ) : (
              <div className="w-12 h-12 rounded-sm bg-primary/8 flex items-center justify-center text-fs-sm font-bold text-primary ring-1 ring-primary/10">
                {v.display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isAvailable && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-card" title="Available" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
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
            <p className="text-[13px] text-muted-foreground leading-snug truncate">{v.categories.join(" · ")}</p>
            {nearestSlot && (
              <div className="mt-1.5">
                <UrgencyBadge slot={nearestSlot} />
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onToggleFavorite(v.vendor_id); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors active:scale-95 shrink-0 -mt-0.5 -mr-1"
            aria-label={isFav ? "Remove from saved" : "Save provider"}
          >
            <Heart className={cn("w-4 h-4 transition-colors", isFav ? "fill-destructive text-destructive" : "text-muted-foreground/60 group-hover:text-muted-foreground")} />
          </button>
        </div>

        {/* Bio snippet */}
        {v.bio && (
          <p className="text-[13px] text-body leading-relaxed line-clamp-2 mb-3">{v.bio}</p>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
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
        </div>

        {/* Availability */}
        <div className={cn(
          "flex items-center gap-1.5 text-[13px] px-2.5 py-1.5 rounded-lg mb-3",
          isAvailable
            ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
            : "bg-muted/60 text-muted-foreground"
        )}>
          <Clock className="w-3 h-3 shrink-0" />
          <span className="font-medium">
            {isAvailable ? `${v.available_slots} slot${v.available_slots !== 1 ? "s" : ""} this week` : "No availability"}
          </span>
        </div>

        {/* Location */}
        {v.address && (
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-3">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{v.address}</span>
          </div>
        )}

        {/* Subcategory badges */}
        {(() => {
          const subNames = [...new Set(v.services.map((s) => s.subcategory_name).filter(Boolean))] as string[];
          return subNames.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-3">
              {subNames.slice(0, 3).map((name) => (
                <button
                  key={name}
                  onClick={() => handleSubcategoryClick(name)}
                  className="text-[10px] font-semibold bg-primary/6 text-primary px-2 py-0.5 rounded-full border border-primary/12 hover:bg-primary/12 transition-colors cursor-pointer"
                >
                  {name}
                </button>
              ))}
              {subNames.length > 3 && (
                <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5">+{subNames.length - 3}</span>
              )}
            </div>
          ) : null;
        })()}

        {/* Service chips */}
        <div className="flex flex-wrap gap-1 mb-4">
          {v.services.slice(0, 3).map((s) => (
            <Link
              key={s.id}
              to={`/service/${s.id}`}
              className="text-[10px] font-medium bg-muted/60 text-body px-2 py-0.5 rounded-full border border-border/30 hover:bg-primary/8 hover:text-primary hover:border-primary/20 transition-colors"
            >
              {s.title}
              {s.price_min ? ` · $${s.price_min}${s.price_type === "hourly" ? "/hr" : ""}` : ""}
            </Link>
          ))}
          {v.services.length > 3 && (
            <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5">+{v.services.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="border-t border-border/30 px-4 py-2.5 flex items-center gap-2 bg-muted/15 mt-auto">
        <Link to={v.services.length > 0 ? `/service/${v.services[0].id}` : `/provider/${v.vendor_id}`} className="flex-1">
          <Button size="sm" variant="ghost" className="w-full text-fs-xs text-muted-foreground hover:text-foreground">
            View Details
          </Button>
        </Link>
        {cannotBook ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button size="sm" disabled className="w-full text-fs-xs gap-1 pointer-events-auto cursor-not-allowed text-primary-foreground">
                    <Lock className="w-3 h-3" /> Book Now
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Booking requires a customer account</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : v.services.length <= 1 ? (
          <Link to={v.services.length === 1 ? `/book?service=${v.services[0].id}&provider=${v.vendor_id}` : `/book?provider=${v.vendor_id}`} className="flex-1">
            <Button size="sm" className="w-full text-fs-xs gap-1 text-primary-foreground">
              Book Now <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="flex-1 text-fs-xs gap-1 text-primary-foreground">
                {minPrice != null ? `Book from $${minPrice}` : "Book Now"} <ChevronDown className="w-3 h-3 opacity-80" />
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
    </article>
  );
};

export default ProviderGridCard;
