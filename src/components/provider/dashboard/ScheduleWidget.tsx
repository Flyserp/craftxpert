import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfToday } from "date-fns";
import type { ProviderBooking } from "./types";
import { Heading } from "@/components/ui/app";

interface DayEntry {
  date: Date;
  bookings: ProviderBooking[];
}

interface Props {
  days: DayEntry[];
}

const ScheduleWidget = ({ days }: Props) => {
  const today = startOfToday();

  return (
    <section className="bg-card rounded-sm border border-border overflow-hidden animate-reveal-delay-1">
      <div className="p-5 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-500" />
          <Heading level={3} >7-Day Schedule</Heading>
        </div>
        <Link to="/provider-availability" className="text-fs-xs text-primary font-medium hover:underline">Manage</Link>
      </div>
      <div className="divide-y divide-border/40">
        {days.map(({ date, bookings: dayBookings }) => {
          const isToday = isSameDay(date, today);
          return (
            <div key={date.toISOString()} className={cn("px-5 py-3 hover:bg-muted/20 transition-colors", isToday && "bg-primary/[0.03]")}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-fs-xs font-medium", isToday ? "text-primary" : "text-heading")}>
                  {isToday ? "Today" : format(date, "EEE, MMM d")}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {dayBookings.length} job{dayBookings.length !== 1 ? "s" : ""}
                </span>
              </div>
              {dayBookings.length > 0 && (
                <div className="space-y-1">
                  {dayBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-[13px] text-body truncate">{b.service?.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{b.start_time?.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ScheduleWidget;
