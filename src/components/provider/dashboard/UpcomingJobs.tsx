import { Link } from "react-router-dom";
import { CalendarCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { STATUS_STYLE, STATUS_ICON, type ProviderBooking } from "./types";
import { Heading } from "@/components/ui/app";

interface Props {
  bookings: ProviderBooking[];
}

const UpcomingJobs = ({ bookings }: Props) => (
  <section className="bg-card rounded-sm border border-border overflow-hidden animate-reveal-delay-1">
    <div className="p-5 border-b border-border/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-blue-500" />
        <Heading level={3} >Upcoming Jobs</Heading>
      </div>
      <Link to="/provider-bookings" className="text-fs-xs text-primary font-medium hover:underline">View all</Link>
    </div>
    {bookings.length === 0 ? (
      <div className="p-8 text-center">
        <CalendarCheck className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-description-sm">No upcoming jobs scheduled</p>
      </div>
    ) : (
      <div className="divide-y divide-border/40">
        {bookings.slice(0, 4).map((b) => {
          const Icon = STATUS_ICON[b.status] || Clock;
          return (
            <div key={b.id} className="p-5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
              <div className="w-10 h-10 rounded-sm bg-blue-500/10 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-fs-sm font-semibold text-heading truncate">{b.service?.title || "Service"}</p>
                <p className="text-fs-xs text-muted-foreground">
                  {format(new Date(b.booking_date + "T00:00:00"), "EEE, MMM d")} at {b.start_time?.slice(0, 5)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {b.total_price != null && <span className="text-fs-xs font-semibold text-heading tabular-nums">${Number(b.total_price).toFixed(0)}</span>}
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", STATUS_STYLE[b.status])}>
                  <Icon className="w-3 h-3" />
                  {b.status.replace("_", " ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

export default UpcomingJobs;
