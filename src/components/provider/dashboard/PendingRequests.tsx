import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, X } from "lucide-react";
import { format } from "date-fns";
import type { ProviderBooking } from "./types";
import { Heading } from "@/components/ui/app";

interface Props {
  bookings: ProviderBooking[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const PendingRequests = ({ bookings, onAccept, onDecline }: Props) => (
  <section className="bg-card rounded-sm border border-border overflow-hidden animate-reveal-delay-1">
    <div className="p-5 border-b border-border/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-500" />
        <Heading level={3} >Pending Requests</Heading>
        {bookings.length > 0 && (
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full tabular-nums">
            {bookings.length}
          </span>
        )}
      </div>
      <Link to="/provider-bookings" className="text-fs-xs text-primary font-medium hover:underline">View all</Link>
    </div>
    {bookings.length === 0 ? (
      <div className="p-8 text-center">
        <CheckCircle className="w-7 h-7 mx-auto mb-2 text-primary/30" />
        <p className="text-description-sm">No pending requests. You're all caught up!</p>
      </div>
    ) : (
      <div className="divide-y divide-border/40">
        {bookings.slice(0, 4).map((b) => (
          <div key={b.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-sm bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-fs-sm font-semibold text-heading truncate">{b.service?.title || "Service"}</p>
                <p className="text-fs-xs text-muted-foreground">
                  {format(new Date(b.booking_date + "T00:00:00"), "EEE, MMM d")} at {b.start_time?.slice(0, 5)}
                  {b.total_price != null && <> • <span className="font-medium">${Number(b.total_price).toFixed(0)}</span></>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="gap-1 text-fs-xs" onClick={() => onAccept(b.id)}>
                <CheckCircle className="w-3 h-3" /> Accept
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-fs-xs text-destructive hover:text-destructive" onClick={() => onDecline(b.id)}>
                <X className="w-3 h-3" /> Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default PendingRequests;
