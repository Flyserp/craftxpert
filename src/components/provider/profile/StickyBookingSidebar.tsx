import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Lock, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import VendorAvailabilityCalendar from "@/components/booking/VendorAvailabilityCalendar";

interface StickyBookingSidebarProps {
  providerId: string;
  providerName: string;
  defaultCategoryId: string;
  defaultServiceId?: string;
  priceFromMin: number | null;
  priceFromMax: number | null;
  priceType: string | null;
  avgRating: number;
  reviewCount: number;
  cannotBook: boolean;
  onMessageClick: () => void;
  onSignInClick: () => void;
}

export default function StickyBookingSidebar({
  providerId, providerName, defaultCategoryId, defaultServiceId,
  priceFromMin, priceFromMax, priceType, avgRating, reviewCount,
  cannotBook, onMessageClick, onSignInClick,
}: StickyBookingSidebarProps) {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("");

  const handleBook = () => {
    if (cannotBook) { onSignInClick(); return; }
    const params = new URLSearchParams();
    params.set("category", defaultCategoryId);
    params.set("provider", providerId);
    if (defaultServiceId) params.set("service", defaultServiceId);
    if (date) params.set("date", format(date, "yyyy-MM-dd"));
    if (time) params.set("time", time);
    navigate(`/book?${params.toString()}`);
  };

  const priceLabel = priceFromMin != null
    ? priceFromMax && priceFromMax !== priceFromMin
      ? `$${priceFromMin}–$${priceFromMax}`
      : `$${priceFromMin}`
    : "—";

  return (
    <aside className="hidden lg:block lg:sticky lg:top-24 self-start">
      <div className="bg-card rounded-sm border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/60">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-fs-xs uppercase tracking-wide text-muted-foreground font-medium">
              From
            </span>
            {avgRating > 0 && (
              <span className="flex items-center gap-1 text-fs-xs text-muted-foreground">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-heading font-semibold">{avgRating}</span>
                <span>({reviewCount})</span>
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-fs-2xl font-bold text-heading tabular-nums">{priceLabel}</span>
            {priceType && (
              <span className="text-fs-xs text-muted-foreground capitalize">/ {priceType}</span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <VendorAvailabilityCalendar
            vendorId={providerId}
            value={date}
            time={time}
            onDateChange={setDate}
            onTimeChange={setTime}
          />

          <Button onClick={handleBook} className="w-full gap-2" size="lg">
            {cannotBook ? <Lock className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
            {cannotBook
              ? "Sign in to Book"
              : date && time
                ? `Book ${format(date, "MMM d")} at ${time}`
                : date
                  ? `Continue with ${format(date, "MMM d")}`
                  : "Book Now"}
          </Button>

          <Button
            onClick={onMessageClick}
            variant="outline"
            className="w-full gap-2"
            disabled={cannotBook}
          >
            <MessageSquare className="w-4 h-4" /> Message {providerName.split(" ")[0]}
          </Button>

          <p className="text-[13px] text-muted-foreground text-center leading-relaxed">
            You won't be charged yet — review pricing on the next step.
          </p>
        </div>
      </div>
    </aside>
  );
}
