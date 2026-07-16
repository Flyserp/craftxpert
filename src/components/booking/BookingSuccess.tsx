import { useEffect } from "react";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import {
  PartyPopper, CheckCircle, Home, ArrowUpRight, MessageSquare, CalendarPlus, CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadIcs, buildGoogleCalendarUrl } from "@/lib/calendarInvite";
import { toast } from "sonner";
import type { AppliedCouponData } from "@/components/booking/PaymentStep";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

interface VendorLite {
  vendor_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  address?: string | null;
}
interface ServiceLite {
  id: string;
  title: string;
  price_min: number | null;
}

interface Props {
  bookingId: string | null;
  vendor: VendorLite | null;
  service: ServiceLite | null;
  date: Date | null;
  startTime: string | null;
  payable: number | null;
  paymentType: "full" | "deposit";
  appliedCoupon: AppliedCouponData | null;
  notes?: string;
  customerAddress?: string;
  onDashboard: () => void;
  onMessage: () => void;
  onBrowse: () => void;
}

const readToken = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
};

const fireConfetti = () => {
  // Pull from centralized chart tokens so confetti follows the active theme.
  const colors = [
    readToken("--chart-1", "#0073d2"),
    readToken("--chart-2", "#cd9200"),
    readToken("--chart-3", "#104e64"),
    readToken("--accent",  "#9DBD47"),
  ];
  const burst = (origin: { x: number; y: number }) =>
    confetti({
      particleCount: 80,
      spread: 75,
      startVelocity: 45,
      origin,
      colors,
      ticks: 200,
      scalar: 1,
      disableForReducedMotion: true,
    });
  burst({ x: 0.2, y: 0.4 });
  burst({ x: 0.5, y: 0.3 });
  burst({ x: 0.8, y: 0.4 });
  setTimeout(() => burst({ x: 0.5, y: 0.5 }), 250);
};

const BookingSuccess = ({
  bookingId, vendor, service, date, startTime, payable, paymentType,
  appliedCoupon, notes, customerAddress, onDashboard, onMessage, onBrowse,
}: Props) => {
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";
  useEffect(() => {
    fireConfetti();
  }, []);

  const buildEventArgs = () => {
    if (!bookingId || !service || !date || !startTime) return null;
    const [h, m] = startTime.split(":").map(Number);
    const endH = h + 1;
    const endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const location = customerAddress || vendor?.address || undefined;
    const descriptionLines = [
      `Booking on ${brand}.`,
      `Professional: ${vendor?.display_name || "TBD"}`,
      `Service: ${service.title}`,
      location ? `Address: ${location}` : null,
      notes?.trim() ? `Notes: ${notes.trim()}` : null,
      `Booking ID: ${bookingId.slice(0, 8)}`,
    ].filter(Boolean) as string[];
    return {
      uid: bookingId,
      title: `${service.title}${vendor?.display_name ? ` with ${vendor.display_name}` : ""}`,
      description: descriptionLines.join("\n"),
      location,
      date,
      startTime,
      endTime,
      organizerName: vendor?.display_name || brand,
    };
  };

  const handleDownloadIcs = () => {
    const args = buildEventArgs();
    if (!args) {
      toast.error("Missing booking info for calendar export.");
      return;
    }
    downloadIcs(`booking-${bookingId!.slice(0, 8)}`, args);
    toast.success("Calendar invite downloaded");
  };

  const handleGoogleCalendar = () => {
    const args = buildEventArgs();
    if (!args) {
      toast.error("Missing booking info for calendar export.");
      return;
    }
    window.open(buildGoogleCalendarUrl(args), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="animate-reveal text-center py-8">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center splash-icon">
          <PartyPopper className="w-10 h-10 text-primary" />
        </div>
      </div>

      <Heading level={1}  className="mb-2 splash-text">Booking Confirmed!</Heading>
      <p className="text-body max-w-md mx-auto mb-8 splash-text">
        Your booking is in. {vendor?.display_name?.split(" ")[0] || "Your pro"} will be notified and you'll get an update once they accept.
      </p>

      {/* Summary card */}
      <div className="bg-card rounded-sm border border-border p-6 text-left max-w-md mx-auto mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-primary/10 overflow-hidden flex items-center justify-center text-fs-xs font-bold text-primary shrink-0">
              {vendor?.avatar_url ? (
                <img src={vendor.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (vendor?.display_name || "V").slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-fs-sm font-semibold text-heading">{vendor?.display_name}</p>
              <p className="text-fs-xs text-muted-foreground">{service?.title}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Date</p>
              <p className="text-fs-sm font-medium text-heading">{date && format(date, "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Time</p>
              <p className="text-fs-sm font-medium text-heading">{startTime}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Amount</p>
              <p className="text-fs-sm font-medium text-heading tabular-nums">
                {payable ? `$${payable}` : "TBD"}
                {paymentType === "deposit" && <span className="text-[10px] text-muted-foreground ml-1">(deposit)</span>}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Status</p>
              <span className="inline-flex items-center gap-1 text-fs-xs font-medium text-primary">
                <CheckCircle className="w-3 h-3" /> Pending
              </span>
            </div>
          </div>

          {appliedCoupon && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/40">
              <span className="inline-flex items-center gap-1 text-fs-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
                🏷️ {appliedCoupon.code}
              </span>
              <span className="text-fs-xs text-muted-foreground">
                saved ${appliedCoupon.discountAmount.toFixed(2)}
              </span>
            </div>
          )}

          {bookingId && (
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/40 tabular-nums">
              Booking ID: {bookingId.slice(0, 8)}
            </p>
          )}
        </div>
      </div>

      {/* Primary CTA: Message */}
      <div className="max-w-md mx-auto mb-3">
        <Button onClick={onMessage} size="lg" className="w-full gap-2 shadow-sm">
          <MessageSquare className="w-4 h-4" />
          Message {vendor?.display_name?.split(" ")[0] || "your pro"}
        </Button>
        <p className="text-[13px] text-muted-foreground mt-1.5">
          Send access details, photos, or questions directly.
        </p>
      </div>

      {/* Secondary actions */}
      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <Button variant="outline" onClick={handleGoogleCalendar} className="flex-1 gap-1.5">
          <CalendarRange className="w-4 h-4" /> Google Calendar
        </Button>
        <Button variant="outline" onClick={handleDownloadIcs} className="flex-1 gap-1.5">
          <CalendarPlus className="w-4 h-4" /> Download .ics
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mt-2">
        <Button variant="outline" onClick={onDashboard} className="flex-1 gap-1.5">
          <Home className="w-4 h-4" /> Dashboard
        </Button>
        <Button variant="ghost" onClick={onBrowse} className="flex-1 gap-1.5">
          <ArrowUpRight className="w-4 h-4" /> Browse
        </Button>
      </div>
    </div>
  );
};

export default BookingSuccess;
