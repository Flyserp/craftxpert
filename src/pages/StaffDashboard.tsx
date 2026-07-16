import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, User, Loader2, CalendarDays, Timer } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import StaffOnboardingChecklist from "@/components/staff/StaffOnboardingChecklist";
import { notifyBookingTransition } from "@/lib/notifications";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

type StaffBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  total_price: number | null;
  customer_id: string;
  vendor_id: string;
  service_id: string;
  customer_name?: string;
  vendor_name?: string;
  service_title?: string;
};

const STATUS_FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export default function StaffDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusBookingId = searchParams.get("booking");
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]["value"]>("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!user) return;
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // When a ?booking= deep-link is present, switch to the "All" filter so the
  // target row is guaranteed to be visible regardless of its status.
  useEffect(() => {
    if (focusBookingId) setFilter("all");
  }, [focusBookingId]);

  // After bookings load and the focused row exists in the DOM, scroll to it
  // and apply a temporary highlight ring. Then strip the param so a refresh
  // doesn't re-trigger the highlight.
  useEffect(() => {
    if (!focusBookingId || loading) return;
    const exists = bookings.some((b) => b.id === focusBookingId);
    if (!exists) return;
    const el = cardRefs.current[focusBookingId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(focusBookingId);
    const t = window.setTimeout(() => {
      setHighlightId(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("booking");
          return next;
        },
        { replace: true },
      );
    }, 2400);
    return () => window.clearTimeout(t);
  }, [focusBookingId, loading, bookings, setSearchParams]);

  const loadBookings = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, status, notes, total_price, customer_id, vendor_id, service_id")
      .eq("assigned_staff_id", user.id)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      toast.error("Failed to load bookings", { description: error.message });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as StaffBooking[];
    if (rows.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    // Hydrate names in parallel
    const userIds = Array.from(new Set(rows.flatMap((b) => [b.customer_id, b.vendor_id])));
    const serviceIds = Array.from(new Set(rows.map((b) => b.service_id)));

    const [{ data: profiles }, { data: services }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
      supabase.from("vendor_services").select("id, title").in("id", serviceIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? "Unknown"]));
    const serviceMap = new Map((services ?? []).map((s) => [s.id, s.title]));

    setBookings(
      rows.map((b) => ({
        ...b,
        customer_name: profileMap.get(b.customer_id) ?? "Customer",
        vendor_name: profileMap.get(b.vendor_id) ?? "Provider",
        service_title: serviceMap.get(b.service_id) ?? "Service",
      })),
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (filter) {
      case "upcoming":
        return bookings.filter(
          (b) => b.booking_date >= today && ["pending", "confirmed"].includes(b.status),
        );
      case "in_progress":
        return bookings.filter((b) => b.status === "in_progress");
      case "completed":
        return bookings.filter((b) => b.status === "completed");
      case "all":
      default:
        return bookings;
    }
  }, [bookings, filter]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 10);

  const summary = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const active = bookings.filter((b) => b.status !== "cancelled");

    const todays = active.filter((b) => b.booking_date === today);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nextToday = todays
      .filter((b) => timeToMinutes(b.start_time) >= nowMins)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    const nextUpcoming =
      nextToday ??
      active
        .filter((b) => b.booking_date > today)
        .sort((a, b) =>
          a.booking_date === b.booking_date
            ? a.start_time.localeCompare(b.start_time)
            : a.booking_date.localeCompare(b.booking_date),
        )[0];

    const weekMinutes = active
      .filter((b) => {
        const d = parseISO(b.booking_date);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      })
      .reduce(
        (acc, b) => acc + Math.max(0, timeToMinutes(b.end_time) - timeToMinutes(b.start_time)),
        0,
      );

    return {
      todayCount: todays.length,
      nextUpcoming,
      weekHours: weekMinutes / 60,
    };
  }, [bookings]);

  const updateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    const booking = bookings.find((b) => b.id === bookingId);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", bookingId);
    setUpdatingId(null);

    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    toast.success(`Marked as ${newStatus.replace("_", " ")}`);
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)),
    );

    if (booking && user) {
      const map: Record<string, Parameters<typeof notifyBookingTransition>[0] | undefined> = {
        in_progress: "in_progress",
        completed: "completed",
        cancelled: "cancelled",
      };
      const t = map[newStatus];
      if (t) {
        await notifyBookingTransition(t, {
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id,
          actorId: user.id,
          providerName: booking.vendor_name || "your provider",
          bookingDate: booking.booking_date,
          serviceName: booking.service_title,
        });
      }
    }
  };

  const renderActions = (b: StaffBooking) => {
    const busy = updatingId === b.id;
    if (b.status === "confirmed" || b.status === "pending") {
      return (
        <Button size="sm" disabled={busy} onClick={() => updateStatus(b.id, "in_progress")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start job"}
        </Button>
      );
    }
    if (b.status === "in_progress") {
      return (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => updateStatus(b.id, "completed")}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark complete"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => updateStatus(b.id, "cancelled")}
          >
            Cancel
          </Button>
        </div>
      );
    }
    return <span className="text-fs-xs text-muted-foreground">No actions available</span>;
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Staff Dashboard">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout title="Staff Dashboard">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your assigned jobs.</p>
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Staff Dashboard"
      subtitle="Jobs assigned to you. Update status as you work through them."
    >
      <div className="space-y-4">
        <StaffOnboardingChecklist
          userId={user.id}
          hasAssignedBooking={bookings.length > 0}
        />
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">Jobs today</p>
                <p className="text-fs-2xl font-semibold leading-tight">{summary.todayCount}</p>
                <p className="text-fs-xs text-muted-foreground mt-0.5">
                  {summary.todayCount === 0 ? "Nothing scheduled" : format(new Date(), "EEE, MMM d")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">Next job</p>
                {summary.nextUpcoming ? (
                  <>
                    <p className="text-fs-2xl font-semibold leading-tight">
                      {summary.nextUpcoming.start_time.slice(0, 5)}
                    </p>
                    <p className="text-fs-xs text-muted-foreground mt-0.5 truncate">
                      {format(parseISO(summary.nextUpcoming.booking_date), "EEE, MMM d")} ·{" "}
                      {summary.nextUpcoming.service_title}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-fs-2xl font-semibold leading-tight">—</p>
                    <p className="text-fs-xs text-muted-foreground mt-0.5">No upcoming jobs</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Timer className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">Hours this week</p>
                <p className="text-fs-2xl font-semibold leading-tight">
                  {summary.weekHours.toFixed(1)}
                  <span className="text-fs-sm font-normal text-muted-foreground ml-1">h</span>
                </p>
                <p className="text-fs-xs text-muted-foreground mt-0.5">Mon – Sun scheduled</p>
              </div>
            </div>
          </div>
        </Card>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No jobs in this view"
            description={
              bookings.length === 0
                ? "You haven't been assigned to any bookings yet. Your provider will assign work to you."
                : "Try a different filter to see other jobs."
            }
          />
        ) : (
          <>
            <div className="grid gap-3">
              {pageItems.map((b) => (
                <Card
                  key={b.id}
                  ref={(el) => {
                    cardRefs.current[b.id] = el;
                  }}
                  className={cn(
                    "p-4 transition-shadow",
                    highlightId === b.id &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
                  )}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Heading level={3}  className="truncate">{b.service_title}</Heading>
                        <Badge className={STATUS_COLORS[b.status] ?? ""} variant="secondary">
                          {b.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-fs-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(b.booking_date), "EEE, MMM d, yyyy")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {b.customer_name}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          For {b.vendor_name}
                        </span>
                      </div>
                      {b.notes && (
                        <p className="text-fs-sm text-muted-foreground line-clamp-2">{b.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">{renderActions(b)}</div>
                  </div>
                </Card>
              ))}
            </div>
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
          onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
