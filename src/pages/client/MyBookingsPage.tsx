import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CalendarCheck, Clock, CheckCircle, AlertCircle, MessageSquare,
  X, Star, Plus, MapPin, CalendarClock, ChevronRight, Search, CalendarRange, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CancelBookingModal from "@/components/booking/CancelBookingModal";
import ProposeRescheduleModal from "@/components/booking/ProposeRescheduleModal";
import DownloadReceiptButton from "@/components/booking/DownloadReceiptButton";
import ReportIssueModal from "@/components/disputes/ReportIssueModal";
import { cancelBookingWithRefund } from "@/lib/bookingActions";
import { proposeReschedule } from "@/lib/rescheduleRequests";
import { evaluateBookingPolicy } from "@/lib/bookingPolicy";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import LeaveReviewModal from "@/components/reviews/LeaveReviewModal";

interface BookingRow {
  id: string;
  customer_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  vendor_id: string;
  service_id: string;
  notes: string | null;
  service_title?: string;
  vendor_name?: string;
  vendor_avatar?: string | null;
  has_review?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  accepted: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  confirmed: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: CalendarCheck,
  confirmed: CalendarCheck,
  in_progress: Clock,
  completed: CheckCircle,
  cancelled: AlertCircle,
};

const UPCOMING = ["pending", "accepted", "confirmed", "in_progress"];
const PAST = ["completed"];
const CANCELLED = ["cancelled"];

const VALID_TABS = ["upcoming", "past", "cancelled"] as const;
type TabKey = (typeof VALID_TABS)[number];

const parseDateParam = (v: string | null): Date | undefined => {
  if (!v) return undefined;
  const d = parseISO(v);
  return isValid(d) ? d : undefined;
};

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate filter state from URL on first render so links are shareable.
  const initialTab = (VALID_TABS as readonly string[]).includes(searchParams.get("tab") || "")
    ? (searchParams.get("tab") as TabKey)
    : "upcoming";
  const initialFrom = parseDateParam(searchParams.get("from"));
  const initialTo = parseDateParam(searchParams.get("to"));

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [actionBooking, setActionBooking] = useState<BookingRow | null>(null);
  const [actionType, setActionType] = useState<"cancel" | "reschedule" | "review" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disputeBooking, setDisputeBooking] = useState<BookingRow | null>(null);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialFrom || initialTo ? { from: initialFrom, to: initialTo } : undefined,
  );

  // Sync filter state -> URL (replace so we don't pollute history on every keystroke).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab && tab !== "upcoming") next.set("tab", tab); else next.delete("tab");
    if (search.trim()) next.set("q", search.trim()); else next.delete("q");
    if (dateRange?.from) next.set("from", format(dateRange.from, "yyyy-MM-dd")); else next.delete("from");
    if (dateRange?.to) next.set("to", format(dateRange.to, "yyyy-MM-dd")); else next.delete("to");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, dateRange?.from, dateRange?.to]);


  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("bookings")
      .select("id, customer_id, booking_date, start_time, end_time, status, payment_status, total_price, vendor_id, service_id, notes")
      .order("booking_date", { ascending: false });
    query = query.eq("customer_id", user.id);
    const { data: rows, error } = await query;

    if (error) {
      toast.error("Failed to load bookings");
      setLoading(false);
      return;
    }

    const list = (rows || []) as BookingRow[];
    if (list.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const vendorIds = Array.from(new Set(list.map((b) => b.vendor_id)));
    const serviceIds = Array.from(new Set(list.map((b) => b.service_id)));
    const bookingIds = list.map((b) => b.id);

    const [profilesRes, servicesRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", vendorIds),
      supabase.from("vendor_services").select("id, title").in("id", serviceIds),
      supabase.from("reviews").select("booking_id").in("booking_id", bookingIds),
    ]);

    const vendorMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
    const serviceMap = new Map((servicesRes.data || []).map((s) => [s.id, s]));
    const reviewSet = new Set((reviewsRes.data || []).map((r) => r.booking_id));

    setBookings(
      list.map((b) => ({
        ...b,
        vendor_name: vendorMap.get(b.vendor_id)?.display_name ?? "Provider",
        vendor_avatar: vendorMap.get(b.vendor_id)?.avatar_url ?? null,
        service_title: serviceMap.get(b.service_id)?.title ?? "Service",
        has_review: reviewSet.has(b.id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const set = tab === "upcoming" ? UPCOMING : tab === "past" ? PAST : CANCELLED;
    const q = search.trim().toLowerCase();
    const fromTs = dateRange?.from ? new Date(dateRange.from).setHours(0, 0, 0, 0) : null;
    const toTs = dateRange?.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : fromTs;
    return bookings.filter((b) => {
      if (!set.includes(b.status)) return false;
      if (q) {
        const hay = `${b.service_title ?? ""} ${b.vendor_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fromTs != null) {
        const ts = new Date(b.booking_date + "T00:00:00").getTime();
        if (ts < fromTs || (toTs != null && ts > toTs)) return false;
      }
      return true;
    });
  }, [bookings, tab, search, dateRange]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 10);

  const counts = useMemo(
    () => ({
      upcoming: bookings.filter((b) => UPCOMING.includes(b.status)).length,
      past: bookings.filter((b) => PAST.includes(b.status)).length,
      cancelled: bookings.filter((b) => CANCELLED.includes(b.status)).length,
    }),
    [bookings]
  );

  const handleCancelConfirm = async () => {
    if (!actionBooking) return;
    setSubmitting(true);
    try {
      const { refunded } = await cancelBookingWithRefund(actionBooking, actionBooking.vendor_name);
      toast.success(
        refunded > 0
          ? `Cancelled — $${refunded.toFixed(2)} credited to your wallet.`
          : "Booking cancelled.",
      );
      setBookings((prev) => prev.map((b) => (b.id === actionBooking.id ? { ...b, status: "cancelled" } : b)));
      setActionType(null);
      setActionBooking(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleConfirm = async (newDate: string, newStart: string, message: string) => {
    if (!actionBooking || !user) return;
    setSubmitting(true);
    try {
      await proposeReschedule({
        booking: actionBooking,
        proposerId: user.id,
        proposerRole: "customer",
        newDate,
        newStart,
        message,
        proposerName: "Your customer",
      });
      toast.success("Reschedule request sent — waiting for the provider to approve.");
      setBookings((prev) => prev.map((b) => (b.id === actionBooking.id
        ? { ...b, status: "reschedule_requested" }
        : b)));
      setActionType(null);
      setActionBooking(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reschedule request");
    } finally {
      setSubmitting(false);
    }
  };

  const openChat = async (vendorId: string) => {
    if (!user) return;
    // find existing conversation
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .or(
        `and(participant_1.eq.${user.id},participant_2.eq.${vendorId}),and(participant_1.eq.${vendorId},participant_2.eq.${user.id})`
      )
      .limit(1);
    let convId = convs?.[0]?.id;
    if (!convId) {
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ participant_1: user.id, participant_2: vendorId })
        .select("id")
        .single();
      if (error || !newConv) {
        toast.error("Could not open chat");
        return;
      }
      convId = newConv.id;
    }
    window.location.assign(`/chat/${convId}`);
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-sm" />
          ))}
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="bg-card border border-border rounded-sm p-12 text-center">
          <CalendarCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-description-sm mb-4">
            {tab === "upcoming"
              ? "No upcoming bookings yet."
              : tab === "past"
              ? "No completed bookings yet."
              : "No cancelled bookings."}
          </p>
          <Link to="/browse">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Book a Service
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {pageItems.map((b) => {
          const Icon = STATUS_ICON[b.status] || Clock;
          return (
            <article
              key={b.id}
              className="bg-card rounded-sm border border-border p-4 sm:p-5 transition-colors hover:border-primary/30 animate-reveal"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {b.vendor_avatar ? (
                    <img
                      src={b.vendor_avatar}
                      alt={b.vendor_name}
                      className="w-12 h-12 rounded-full object-cover ring-1 ring-border/40 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-fs-sm font-bold text-primary shrink-0">
                      {(b.vendor_name || "P")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-fs-sm font-semibold text-heading truncate">{b.service_title}</p>
                    <p className="text-fs-xs text-muted-foreground truncate">
                      with{" "}
                      <Link to={`/provider/${b.vendor_id}`} className="text-primary hover:underline">
                        {b.vendor_name}
                      </Link>
                    </p>
                    <p className="text-fs-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3" />
                      {format(new Date(b.booking_date + "T00:00:00"), "EEE, MMM d, yyyy")} ·{" "}
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {b.total_price != null && (
                    <span className="text-fs-sm font-semibold text-heading tabular-nums">
                      ${Number(b.total_price).toFixed(0)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-fs-xs font-medium px-2.5 py-1 rounded-full",
                      STATUS_STYLE[b.status]
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1).replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/40">
                <Button size="sm" variant="ghost" className="gap-1.5 text-fs-xs" onClick={() => openChat(b.vendor_id)}>
                  <MessageSquare className="w-3.5 h-3.5" /> Chat
                </Button>
                {["pending", "accepted", "confirmed"].includes(b.status) && (() => {
                  const policy = evaluateBookingPolicy({
                    bookingDate: b.booking_date, startTime: b.start_time, status: b.status,
                    paidAmount: Number(b.total_price ?? 0),
                  });
                  return (
                    <>
                      <Button
                        size="sm" variant="ghost"
                        className="gap-1.5 h-8 text-fs-xs"
                        disabled={!policy.canReschedule}
                        onClick={() => { setActionBooking(b); setActionType("reschedule"); }}
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Reschedule
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="gap-1.5 h-8 text-fs-xs text-destructive hover:text-destructive"
                        onClick={() => { setActionBooking(b); setActionType("cancel"); }}
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    </>
                  );
                })()}
                {b.status === "completed" && !b.has_review && (
                  <Button
                    size="sm" variant="outline" className="gap-1.5 text-fs-xs"
                    onClick={() => { setActionBooking(b); setActionType("review"); }}
                  >
                    <Star className="w-3.5 h-3.5" /> Leave a review
                  </Button>
                )}
                {b.status !== "cancelled" && (
                  <DownloadReceiptButton bookingId={b.id} className="h-8 text-fs-xs" />
                )}
                <Link to={`/my-bookings/${b.id}`} className="ml-auto">
                  <Button size="sm" variant="outline" className="gap-1.5 text-fs-xs">
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </article>
          );
        })}
        <NumberedPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>
    );
  };

  return (
    <DashboardLayout title="My Bookings" subtitle="Track every service you've requested.">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by service or provider…"
            className="pl-9 h-10"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 h-10 justify-start sm:w-64">
              <CalendarRange className="w-4 h-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span className="text-fs-xs">
                    {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-fs-xs">{format(dateRange.from, "MMM d, yyyy")}</span>
                )
              ) : (
                <span className="text-fs-xs text-muted-foreground">Filter by date range</span>
              )}
              {dateRange?.from && (
                <X
                  className="w-3.5 h-3.5 ml-auto opacity-60 hover:opacity-100"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDateRange(undefined); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Button asChild variant="outline" className="gap-2 h-10">
          <Link to="/my-invoices">
            <Receipt className="w-4 h-4" /> Invoices
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming" className="gap-1.5">
            Upcoming
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{counts.upcoming}</span>
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            Past
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{counts.past}</span>
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5">
            Cancelled
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{counts.cancelled}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{renderList()}</TabsContent>
        <TabsContent value="past">{renderList()}</TabsContent>
        <TabsContent value="cancelled">{renderList()}</TabsContent>
      </Tabs>

      {actionBooking && actionType === "cancel" && (
        <CancelBookingModal
          open
          onOpenChange={(o) => { if (!o) { setActionType(null); setActionBooking(null); } }}
          bookingDate={actionBooking.booking_date}
          startTime={actionBooking.start_time}
          status={actionBooking.status}
          paidAmount={
            actionBooking.payment_status === "paid" || actionBooking.payment_status === "deposit_paid"
              ? Number(actionBooking.total_price ?? 0) : 0
          }
          vendorName={actionBooking.vendor_name}
          serviceTitle={actionBooking.service_title}
          submitting={submitting}
          onConfirm={handleCancelConfirm}
          onFileDispute={() => {
            setDisputeBooking(actionBooking);
            setActionType(null);
            setActionBooking(null);
          }}
        />
      )}
      {disputeBooking && (
        <ReportIssueModal
          open
          onOpenChange={(o) => { if (!o) setDisputeBooking(null); }}
          bookingId={disputeBooking.id}
          reportedUserId={disputeBooking.vendor_id}
          prefill={{
            type: "service_quality",
            subject: `Cancellation issue — ${disputeBooking.service_title || "booking"} on ${disputeBooking.booking_date}`,
            description: `I tried to cancel my booking with ${disputeBooking.vendor_name || "my pro"} (${disputeBooking.service_title || "service"}) scheduled for ${disputeBooking.booking_date} at ${disputeBooking.start_time?.slice(0, 5)}, but the standard cancellation window has closed (less than 24h before start) and no automatic refund is available.\n\nReason for the dispute:\n• \n\nBooking ID: ${disputeBooking.id}\nAmount paid: $${Number(disputeBooking.total_price ?? 0).toFixed(2)}`,
          }}
        />
      )}
      {actionBooking && actionType === "reschedule" && (
        <ProposeRescheduleModal
          open
          onOpenChange={(o) => { if (!o) { setActionType(null); setActionBooking(null); } }}
          bookingDate={actionBooking.booking_date}
          startTime={actionBooking.start_time}
          status={actionBooking.status}
          customerName={actionBooking.vendor_name}
          serviceTitle={actionBooking.service_title}
          submitting={submitting}
          onConfirm={handleRescheduleConfirm}
        />
      )}
      {actionBooking && actionType === "review" && (
        <LeaveReviewModal
          open
          onOpenChange={(o) => { if (!o) { setActionType(null); setActionBooking(null); } }}
          bookingId={actionBooking.id}
          providerId={actionBooking.vendor_id}
          providerName={actionBooking.vendor_name}
          onReviewSubmitted={() => {
            setBookings((prev) => prev.map((b) => (b.id === actionBooking.id ? { ...b, has_review: true } : b)));
            setActionType(null);
            setActionBooking(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
