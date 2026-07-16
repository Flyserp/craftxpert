import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openBookingThread } from "@/lib/bookingChat";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface BookingOption {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  other_id: string;
  other_name: string;
  service_title: string;
}

interface Props {
  userId: string;
  /** Optional: pre-select this booking's thread on mount. */
  initialBookingId?: string;
}

/**
 * Lets a client/provider start or jump into the message thread for one of
 * their bookings. Each booking maps to its own conversation row.
 */
export default function BookingThreadSelector({ userId, initialBookingId }: Props) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from("bookings")
        .select("id, customer_id, vendor_id, service_id, booking_date, start_time, status")
        .or(`customer_id.eq.${userId},vendor_id.eq.${userId}`)
        .order("booking_date", { ascending: false })
        .limit(40);

      if (!rows || cancelled) {
        if (!cancelled) { setBookings([]); setLoading(false); }
        return;
      }

      const otherIds = Array.from(new Set(
        rows.map((b) => (b.customer_id === userId ? b.vendor_id : b.customer_id)),
      ));
      const serviceIds = Array.from(new Set(rows.map((b) => b.service_id)));

      const [profilesRes, servicesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", otherIds),
        supabase.from("vendor_services").select("id, title").in("id", serviceIds),
      ]);

      if (cancelled) return;
      const nameMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p) => { nameMap[p.user_id] = p.display_name || "User"; });
      const titleMap: Record<string, string> = {};
      (servicesRes.data || []).forEach((s) => { titleMap[s.id] = s.title; });

      setBookings(rows.map((b) => {
        const other = b.customer_id === userId ? b.vendor_id : b.customer_id;
        return {
          id: b.id,
          booking_date: b.booking_date,
          start_time: b.start_time,
          status: b.status,
          other_id: other,
          other_name: nameMap[other] || "User",
          service_title: titleMap[b.service_id] || "Service",
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSelect = async (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    setOpening(bookingId);
    const convoId = await openBookingThread(userId, b.other_id, bookingId);
    setOpening(null);
    if (convoId) navigate(`/chat/${convoId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-fs-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading bookings…
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <p className="text-fs-xs text-muted-foreground px-1">
        No bookings yet — book a service to start a thread.
      </p>
    );
  }

  return (
    <Select value={initialBookingId || undefined} onValueChange={handleSelect}>
      <SelectTrigger className="w-full text-fs-xs h-9">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          <SelectValue placeholder="Open thread for a booking…" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {bookings.map((b) => (
          <SelectItem key={b.id} value={b.id} className="text-fs-xs">
            <div className="flex flex-col">
              <span className="font-medium text-heading">
                {b.service_title} · {b.other_name}
                {opening === b.id && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(b.booking_date), "MMM d, yyyy")} · {b.start_time.slice(0, 5)} · {b.status.replace("_", " ")}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
