import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { CalendarClock, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { evaluateBookingPolicy, formatTimeUntil } from "@/lib/bookingPolicy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  bookingDate: string;
  startTime: string;
  status: string;
  vendorName?: string;
  serviceTitle?: string;
  submitting?: boolean;
  onConfirm: (newDate: string, newStartTime: string) => void;
}

interface AvailabilitySlot { day_of_week: number; start_time: string; end_time: string; }

export default function RescheduleBookingModal({
  open, onOpenChange, vendorId, bookingDate, startTime, status,
  vendorName, serviceTitle, submitting, onConfirm,
}: Props) {
  const policy = useMemo(
    () => evaluateBookingPolicy({ bookingDate, startTime, status, paidAmount: 0 }),
    [bookingDate, startTime, status],
  );

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !vendorId) return;
    let cancelled = false;
    (async () => {
      setLoadingAvail(true);
      const [slotsRes, blockedRes] = await Promise.all([
        supabase
          .from("vendor_availability")
          .select("day_of_week, start_time, end_time")
          .eq("vendor_id", vendorId)
          .eq("is_available", true),
        supabase
          .from("vendor_blocked_dates")
          .select("blocked_date")
          .eq("vendor_id", vendorId),
      ]);
      if (cancelled) return;
      setAvailability((slotsRes.data || []) as AvailabilitySlot[]);
      setBlockedDates(new Set((blockedRes.data || []).map((b) => b.blocked_date)));
      setLoadingAvail(false);
    })();
    return () => { cancelled = true; };
  }, [open, vendorId]);

  // Reset selection when reopened
  useEffect(() => {
    if (open) {
      setDate(undefined);
      setTime(null);
    }
  }, [open]);

  const dayHasSlots = (d: Date) => availability.some((a) => a.day_of_week === d.getDay());

  const slotsForDate = useMemo(() => {
    if (!date) return [] as string[];
    const slots = availability.filter((a) => a.day_of_week === date.getDay());
    const out: string[] = [];
    slots.forEach((s) => {
      const startH = parseInt(s.start_time.split(":")[0], 10);
      const endH = parseInt(s.end_time.split(":")[0], 10);
      for (let h = startH; h < endH; h += 1) out.push(`${String(h).padStart(2, "0")}:00`);
    });
    return out;
  }, [date, availability]);

  const minDate = addDays(new Date(), 1); // day after tomorrow earliest, conservative for the 24h rule
  const isDateBlocked = (d: Date) => {
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    const ymd = format(d, "yyyy-MM-dd");
    if (blockedDates.has(ymd)) return true;
    if (!dayHasSlots(d)) return true;
    return false;
  };

  // If reschedule isn't allowed, render a blocking notice instead.
  if (!policy.canReschedule) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Reschedule unavailable
            </DialogTitle>
            <DialogDescription>
              {policy.rescheduleBlockedReason}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const startDateObj = new Date(`${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Reschedule booking
          </DialogTitle>
          <DialogDescription>
            Currently {serviceTitle ? `${serviceTitle} ` : ""}with {vendorName || "your pro"} on{" "}
            {format(startDateObj, "EEE, MMM d")} at {startTime.slice(0, 5)} ({formatTimeUntil(policy.hoursUntilStart)}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-fs-xs font-medium text-heading mb-2">Pick a new date</p>
            <div className="border border-border rounded-lg p-2">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { setDate(d); setTime(null); }}
                disabled={isDateBlocked}
                fromDate={minDate}
                className={cn("p-0 pointer-events-auto")}
              />
            </div>
            {loadingAvail && <p className="text-[13px] text-muted-foreground mt-1">Loading availability…</p>}
          </div>

          <div>
            <p className="text-fs-xs font-medium text-heading mb-2">Pick a new time</p>
            {!date && (
              <p className="text-fs-xs text-muted-foreground">Choose a date first.</p>
            )}
            {date && slotsForDate.length === 0 && (
              <p className="text-fs-xs text-muted-foreground">No slots available on this day.</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {slotsForDate.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "h-9 rounded-sm border text-fs-xs font-medium transition-colors tabular-nums",
                    time === slot
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep current time
          </Button>
          <Button
            onClick={() => date && time && onConfirm(format(date, "yyyy-MM-dd"), time)}
            disabled={!date || !time || submitting}
            className="gap-1.5"
          >
            <CalendarClock className="w-4 h-4" />
            {submitting ? "Saving…" : "Confirm reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
