import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { CalendarClock, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { evaluateBookingPolicy, formatTimeUntil } from "@/lib/bookingPolicy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingDate: string;
  startTime: string;
  status: string;
  customerName?: string;
  serviceTitle?: string;
  submitting?: boolean;
  onConfirm: (newDate: string, newStartTime: string, message: string) => void;
}

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);

export default function ProposeRescheduleModal({
  open, onOpenChange, bookingDate, startTime, status,
  customerName, serviceTitle, submitting, onConfirm,
}: Props) {
  const policy = useMemo(
    () => evaluateBookingPolicy({ bookingDate, startTime, status, paidAmount: 0 }),
    [bookingDate, startTime, status],
  );

  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setDate(undefined);
      setTime(null);
      setMessage("");
    }
  }, [open]);

  const minDate = addDays(new Date(), 1);
  const isDateBlocked = (d: Date) =>
    d < new Date(new Date().setHours(0, 0, 0, 0));

  if (!policy.canReschedule) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Reschedule unavailable
            </DialogTitle>
            <DialogDescription>
              {policy.rescheduleBlockedReason ||
                "You can only propose a reschedule at least 24 hours before the start time."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const startObj = new Date(`${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Propose a new time
          </DialogTitle>
          <DialogDescription>
            Currently {serviceTitle ? `${serviceTitle} ` : ""}with {customerName || "your customer"} on{" "}
            {format(startObj, "EEE, MMM d")} at {startTime.slice(0, 5)} ({formatTimeUntil(policy.hoursUntilStart)}).
            They'll be asked to approve.
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
          </div>

          <div>
            <p className="text-fs-xs font-medium text-heading mb-2">Pick a new time</p>
            {!date && (
              <p className="text-fs-xs text-muted-foreground">Choose a date first.</p>
            )}
            {date && (
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => (
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
            )}
          </div>
        </div>

        <div>
          <p className="text-fs-xs font-medium text-heading mb-2">Message (optional)</p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Let them know why you're proposing this change…"
            rows={3}
            className="text-fs-sm"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep current time
          </Button>
          <Button
            onClick={() => date && time && onConfirm(format(date, "yyyy-MM-dd"), time, message)}
            disabled={!date || !time || submitting}
            className="gap-1.5"
          >
            <CalendarClock className="w-4 h-4" />
            {submitting ? "Sending…" : "Send to customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
