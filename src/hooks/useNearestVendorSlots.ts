import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, startOfDay, format } from "date-fns";

/**
 * Compute the soonest available 1-hour slot for each vendor in the next
 * `windowHours` (default 72h), considering:
 *  - vendor weekly availability
 *  - blocked dates
 *  - existing non-cancelled bookings
 *
 * Returns a Map<vendorId, { date: Date, time: string, hoursFromNow: number }>.
 */
export interface NearestSlot {
  date: Date;
  time: string; // "HH:mm"
  hoursFromNow: number;
}

export function useNearestVendorSlots(vendorIds: string[], windowHours = 72) {
  const [slots, setSlots] = useState<Map<string, NearestSlot>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendorIds.length === 0) {
      setSlots(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const now = new Date();
      const today = startOfDay(now);
      const daysToScan = Math.ceil(windowHours / 24) + 1;
      const horizon = addDays(today, daysToScan);
      const todayStr = format(today, "yyyy-MM-dd");
      const horizonStr = format(horizon, "yyyy-MM-dd");

      const [availRes, blockedRes, bookingsRes] = await Promise.all([
        supabase
          .from("vendor_availability")
          .select("vendor_id, day_of_week, start_time, end_time")
          .in("vendor_id", vendorIds)
          .eq("is_available", true),
        supabase
          .from("vendor_blocked_dates")
          .select("vendor_id, blocked_date")
          .in("vendor_id", vendorIds)
          .gte("blocked_date", todayStr)
          .lte("blocked_date", horizonStr),
        supabase
          .from("bookings")
          .select("vendor_id, booking_date, start_time, status")
          .in("vendor_id", vendorIds)
          .gte("booking_date", todayStr)
          .lte("booking_date", horizonStr)
          .neq("status", "cancelled"),
      ]);

      if (cancelled) return;

      const avail = availRes.data || [];
      const blocked = blockedRes.data || [];
      const bookings = bookingsRes.data || [];

      // weekly[vendorId][dow] -> [{start,end}]
      const weekly = new Map<string, Map<number, Array<{ start: string; end: string }>>>();
      avail.forEach((a: any) => {
        if (!weekly.has(a.vendor_id)) weekly.set(a.vendor_id, new Map());
        const dayMap = weekly.get(a.vendor_id)!;
        if (!dayMap.has(a.day_of_week)) dayMap.set(a.day_of_week, []);
        dayMap.get(a.day_of_week)!.push({ start: a.start_time, end: a.end_time });
      });

      // blocked[vendorId] -> Set<"YYYY-MM-DD">
      const blockedMap = new Map<string, Set<string>>();
      blocked.forEach((b: any) => {
        if (!blockedMap.has(b.vendor_id)) blockedMap.set(b.vendor_id, new Set());
        blockedMap.get(b.vendor_id)!.add(b.blocked_date);
      });

      // booked[vendorId][date] -> Set<"HH:mm">
      const bookedMap = new Map<string, Map<string, Set<string>>>();
      bookings.forEach((b: any) => {
        if (!bookedMap.has(b.vendor_id)) bookedMap.set(b.vendor_id, new Map());
        const dayMap = bookedMap.get(b.vendor_id)!;
        if (!dayMap.has(b.booking_date)) dayMap.set(b.booking_date, new Set());
        dayMap.get(b.booking_date)!.add((b.start_time as string).slice(0, 5));
      });

      const result = new Map<string, NearestSlot>();

      for (const vendorId of vendorIds) {
        const weeklyForVendor = weekly.get(vendorId);
        if (!weeklyForVendor) continue;

        let found: NearestSlot | null = null;

        for (let offset = 0; offset < daysToScan && !found; offset++) {
          const date = addDays(today, offset);
          const dateStr = format(date, "yyyy-MM-dd");
          if (blockedMap.get(vendorId)?.has(dateStr)) continue;

          const ranges = weeklyForVendor.get(date.getDay()) || [];
          if (ranges.length === 0) continue;

          // Build hourly slots
          const taken = bookedMap.get(vendorId)?.get(dateStr) || new Set<string>();
          const slotsForDay: string[] = [];
          ranges.forEach((r) => {
            const sH = parseInt(r.start.slice(0, 2), 10);
            const eH = parseInt(r.end.slice(0, 2), 10);
            for (let h = sH; h < eH; h++) {
              slotsForDay.push(`${String(h).padStart(2, "0")}:00`);
            }
          });
          slotsForDay.sort();

          for (const t of slotsForDay) {
            if (taken.has(t)) continue;
            const [hh, mm] = t.split(":").map(Number);
            const slotDate = new Date(date);
            slotDate.setHours(hh, mm, 0, 0);
            const diffH = (slotDate.getTime() - now.getTime()) / 3600000;
            if (diffH < 0) continue; // past
            if (diffH > windowHours) break;
            found = { date: slotDate, time: t, hoursFromNow: diffH };
            break;
          }
        }

        if (found) result.set(vendorId, found);
      }

      if (!cancelled) {
        setSlots(result);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorIds.join(","), windowHours]);

  return { slots, loading };
}
