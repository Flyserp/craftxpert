import { useEffect, useMemo, useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string; // "HH:mm:ss"
  end_time: string;
}

interface BookedRow {
  booking_date: string; // "YYYY-MM-DD"
  start_time: string;   // "HH:mm:ss"
}

export interface VendorAvailabilityCalendarProps {
  vendorId: string;
  /** Selected date (controlled). */
  value?: Date;
  /** Selected time, e.g. "09:00". */
  time?: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  /** Days to look ahead when computing the "fully booked" badge. Default 60. */
  lookAheadDays?: number;
  /** Hide the time-slot picker (calendar-only mode). Default false. */
  showTimeSlots?: boolean;
  className?: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Reusable, browsable vendor availability calendar.
 *
 * Behaviour:
 *  - Only dates the vendor accepts work on are enabled.
 *  - Past dates and `vendor_blocked_dates` are disabled.
 *  - When a date is selected, the time picker shows slots from the vendor's
 *    weekly schedule MINUS hours already booked by other customers.
 *  - A small legend explains the colour states.
 */
export default function VendorAvailabilityCalendar({
  vendorId,
  value,
  time,
  onDateChange,
  onTimeChange,
  lookAheadDays = 60,
  showTimeSlots = true,
  className,
}: VendorAvailabilityCalendarProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [bookedByDate, setBookedByDate] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const today = startOfDay(new Date());
      const horizon = addDays(today, lookAheadDays);
      const horizonStr = format(horizon, "yyyy-MM-dd");
      const todayStr = format(today, "yyyy-MM-dd");

      const [slotsRes, blockedRes, bookingsRes] = await Promise.all([
        supabase
          .from("vendor_availability")
          .select("day_of_week, start_time, end_time")
          .eq("vendor_id", vendorId)
          .eq("is_available", true),
        supabase
          .from("vendor_blocked_dates")
          .select("blocked_date")
          .eq("vendor_id", vendorId)
          .gte("blocked_date", todayStr),
        // We only need date+start_time to know which hours are taken.
        // Cancelled bookings free up the slot.
        supabase
          .from("bookings")
          .select("booking_date, start_time, status")
          .eq("vendor_id", vendorId)
          .gte("booking_date", todayStr)
          .lte("booking_date", horizonStr)
          .neq("status", "cancelled"),
      ]);

      if (cancelled) return;

      setSlots(slotsRes.data || []);
      setBlocked(new Set((blockedRes.data || []).map((d: any) => d.blocked_date)));

      const map = new Map<string, Set<string>>();
      (bookingsRes.data || []).forEach((b: BookedRow) => {
        const hh = b.start_time.slice(0, 5); // "HH:mm"
        if (!map.has(b.booking_date)) map.set(b.booking_date, new Set());
        map.get(b.booking_date)!.add(hh);
      });
      setBookedByDate(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, lookAheadDays]);

  const availableDays = useMemo(() => new Set(slots.map((s) => s.day_of_week)), [slots]);

  /** All hourly slots the vendor *could* offer on a given weekday. */
  const weeklySlotsByDay = useMemo(() => {
    const m = new Map<number, string[]>();
    slots.forEach((s) => {
      const out: string[] = [];
      let h = parseInt(s.start_time.slice(0, 2), 10);
      const endH = parseInt(s.end_time.slice(0, 2), 10);
      while (h < endH) {
        out.push(`${String(h).padStart(2, "0")}:00`);
        h += 1;
      }
      const existing = m.get(s.day_of_week) || [];
      m.set(s.day_of_week, [...existing, ...out]);
    });
    return m;
  }, [slots]);

  /** Returns true if every potential slot for that date is already booked. */
  const isDateFullyBooked = (d: Date) => {
    const weekday = d.getDay();
    const potential = weeklySlotsByDay.get(weekday) || [];
    if (potential.length === 0) return false;
    const taken = bookedByDate.get(format(d, "yyyy-MM-dd"));
    if (!taken) return false;
    return potential.every((s) => taken.has(s));
  };

  const isDateDisabled = (d: Date) => {
    const today = startOfDay(new Date());
    if (d < today) return true;
    if (availableDays.size > 0 && !availableDays.has(d.getDay())) return true;
    if (blocked.has(format(d, "yyyy-MM-dd"))) return true;
    if (isDateFullyBooked(d)) return true;
    return false;
  };

  const fullyBookedModifier = (d: Date) => {
    const today = startOfDay(new Date());
    if (d < today) return false;
    if (!availableDays.has(d.getDay())) return false;
    if (blocked.has(format(d, "yyyy-MM-dd"))) return false;
    return isDateFullyBooked(d);
  };

  const blockedModifier = (d: Date) => blocked.has(format(d, "yyyy-MM-dd"));

  const timeOptions = useMemo(() => {
    if (!value) return [];
    const potential = weeklySlotsByDay.get(value.getDay()) || [];
    const taken = bookedByDate.get(format(value, "yyyy-MM-dd")) || new Set<string>();
    // De-dupe + sort, then mark which are taken.
    const unique = Array.from(new Set(potential)).sort();
    return unique.map((t) => ({ time: t, taken: taken.has(t) }));
  }, [value, weeklySlotsByDay, bookedByDate]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-muted/30 p-6 text-center",
          className,
        )}
      >
        <AlertCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-fs-sm font-medium text-heading">No availability published</p>
        <p className="text-fs-xs text-muted-foreground mt-1">
          This pro hasn't set their working hours yet. Try messaging them directly.
        </p>
      </div>
    );
  }

  const fromDate = startOfDay(new Date());
  const toDate = addDays(fromDate, lookAheadDays);
  const workingDayLabels = Array.from(availableDays)
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(", ");

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <CalendarIcon className="w-3 h-3" /> Pick a date
          </label>
          {workingDayLabels && (
            <span className="text-[11px] text-muted-foreground">
              Open {workingDayLabels}
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/50">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onDateChange(d);
              onTimeChange("");
            }}
            disabled={isDateDisabled}
            fromDate={fromDate}
            toDate={toDate}
            modifiers={{ fullyBooked: fullyBookedModifier, blocked: blockedModifier }}
            modifiersClassNames={{
              fullyBooked: "line-through opacity-60",
              blocked: "line-through opacity-40",
            }}
            className={cn("p-2 pointer-events-auto")}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Closed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400/60" /> Fully booked
          </span>
        </div>
      </div>

      {showTimeSlots && value && (
        <div>
          <label className="text-[13px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Available times — {format(value, "EEE, MMM d")}
          </label>
          {timeOptions.length === 0 ? (
            <p className="text-fs-xs text-muted-foreground py-2">
              No slots configured for this day.
            </p>
          ) : timeOptions.every((o) => o.taken) ? (
            <p className="text-fs-xs text-amber-700 dark:text-amber-300 py-2">
              All slots on this day are booked. Pick another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {timeOptions.map((o) => {
                const isSelected = time === o.time;
                return (
                  <button
                    key={o.time}
                    type="button"
                    disabled={o.taken}
                    onClick={() => onTimeChange(o.time)}
                    aria-label={
                      o.taken ? `${o.time} — already booked` : `Select ${o.time}`
                    }
                    className={cn(
                      "px-2 py-1.5 rounded-sm text-fs-xs font-medium border transition-colors tabular-nums",
                      o.taken
                        ? "bg-muted text-muted-foreground/60 border-border line-through cursor-not-allowed"
                        : isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    {o.time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
