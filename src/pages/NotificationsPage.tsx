import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import { Bell, Check, CheckCheck, CalendarCheck, CreditCard, AlertCircle, Info, Filter, X, MessageSquare, Star, Megaphone, Navigation, Zap, List, Clock, Briefcase, UserCheck, ShieldCheck, RefreshCw, TimerOff, Trash2, MailOpen, Mail, Search, ExternalLink, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import LeaveReviewModal from "@/components/reviews/LeaveReviewModal";
import ProviderReplyInline from "@/components/reviews/ProviderReplyInline";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { Notification } from "@/hooks/useNotifications";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";

const NOTIFICATION_TYPES = [
  { value: "booking_accepted", label: "Accepted", icon: Check, color: "text-primary" },
  { value: "booking_completed", label: "Completed", icon: CheckCheck, color: "text-primary" },
  { value: "booking_cancelled", label: "Cancelled", icon: AlertCircle, color: "text-destructive" },
  { value: "booking_in_progress", label: "In Progress", icon: Zap, color: "text-amber-500" },
  { value: "provider_on_the_way", label: "On The Way", icon: Navigation, color: "text-blue-500" },
  { value: "payment_success", label: "Payment", icon: CreditCard, color: "text-primary" },
  { value: "payment_failed", label: "Payment Failed", icon: AlertCircle, color: "text-destructive" },
  { value: "payout_sent", label: "Payout", icon: CreditCard, color: "text-primary" },
  { value: "new_message", label: "Message", icon: MessageSquare, color: "text-blue-500" },
  { value: "review_reminder", label: "Review", icon: Star, color: "text-amber-500" },
  { value: "review_received", label: "Review In", icon: Star, color: "text-amber-500" },
  { value: "proposal_received", label: "Application", icon: Briefcase, color: "text-primary" },
  { value: "proposal_accepted", label: "Hired", icon: UserCheck, color: "text-primary" },
  { value: "proposal_shortlisted", label: "Shortlisted", icon: Briefcase, color: "text-amber-500" },
  { value: "hire_confirmed", label: "Hire", icon: UserCheck, color: "text-primary" },
  { value: "subscription_renewed", label: "Renewed", icon: RefreshCw, color: "text-primary" },
  { value: "subscription_expiring", label: "Renewal Due", icon: Clock, color: "text-amber-500" },
  { value: "subscription_expired", label: "Expired", icon: AlertCircle, color: "text-destructive" },
  { value: "verification_approved", label: "Verified", icon: ShieldCheck, color: "text-primary" },
  { value: "verification_rejected", label: "Verification Rejected", icon: AlertCircle, color: "text-destructive" },
  { value: "verification_info_requested", label: "Info Requested", icon: Info, color: "text-amber-500" },
  { value: "job_expiring", label: "Job Expiring", icon: Clock, color: "text-amber-500" },
  { value: "job_expired", label: "Job Expired", icon: TimerOff, color: "text-destructive" },
  { value: "promotion", label: "Promo", icon: Megaphone, color: "text-primary" },
  { value: "info", label: "Info", icon: Info, color: "text-muted-foreground" },
] as const;

const typeMap = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.value, t]));

type RoleFlags = { isAdmin: boolean; isProvider: boolean; isStaff: boolean; isClient: boolean };

function resolveNotificationLink(n: Notification, roles: RoleFlags): string | null {
  const event = (n.metadata?.event as string | undefined) ?? n.type;
  const bookingId = n.metadata?.booking_id as string | undefined;
  const conversationId = n.metadata?.conversation_id as string | undefined;
  const taskId = n.metadata?.task_id as string | undefined;
  const disputeId = n.metadata?.dispute_id as string | undefined;
  const withdrawalId = n.metadata?.withdrawal_id as string | undefined;
  const refundId = n.metadata?.refund_id as string | undefined;
  const verificationId = n.metadata?.verification_id as string | undefined;
  const explicit = (n.metadata?.link as string | undefined) ?? (n.metadata?.url as string | undefined);
  if (explicit) return explicit;

  if (event === "staff_assigned" || event === "staff_unassigned") {
    return bookingId ? `/staff-dashboard?booking=${bookingId}` : "/staff-dashboard";
  }
  if (event === "new_message" || n.type === "new_message") {
    return conversationId ? `/chat?c=${conversationId}` : "/chat";
  }
  if (n.type === "review_received") {
    if (roles.isProvider) return "/provider/reviews";
    return bookingId ? `/client/bookings/${bookingId}` : "/client/reviews";
  }
  if (n.type === "review_reminder") {
    return bookingId ? `/client/bookings/${bookingId}` : "/client/bookings";
  }
  if (n.type.startsWith("booking_") || event === "provider_on_the_way") {
    if (bookingId) {
      if (roles.isProvider) return `/provider/bookings?booking=${bookingId}`;
      if (roles.isClient) return `/client/bookings/${bookingId}`;
    }
    if (roles.isProvider) return "/provider/bookings";
    if (roles.isClient) return "/client/bookings";
  }
  if (n.type === "task_posted" || event === "task_posted") {
    if (roles.isProvider) return taskId ? `/provider/tasks?task=${taskId}` : "/provider/tasks";
    return taskId ? `/client/tasks/${taskId}` : "/browse-tasks";
  }
  if (event === "proposal_received" || event === "proposal_accepted" || event === "proposal_rejected") {
    if (roles.isClient && taskId) return `/client/tasks/${taskId}`;
    if (roles.isProvider) return "/provider/enquiries";
  }
  if (n.type === "payment_success" || n.type === "payment_received") {
    if (roles.isProvider) return "/provider/earnings";
    if (roles.isClient) return "/client/payments";
    if (roles.isAdmin) return "/admin/payments";
  }
  if (event?.startsWith("withdrawal")) {
    if (roles.isAdmin) return withdrawalId ? `/admin/withdrawals?id=${withdrawalId}` : "/admin/withdrawals";
    if (roles.isProvider) return "/provider/withdrawals";
  }
  if (event?.startsWith("refund")) {
    if (roles.isAdmin) return refundId ? `/admin/refunds?id=${refundId}` : "/admin/refunds";
    if (roles.isClient) return "/client/refunds";
  }
  if (event?.startsWith("dispute")) {
    if (roles.isAdmin) return disputeId ? `/admin/disputes?id=${disputeId}` : "/admin/disputes";
    if (roles.isClient) return "/client/disputes";
  }
  if (event?.startsWith("verification") || n.type === "verification_update") {
    if (roles.isAdmin) return verificationId ? `/admin/verifications?id=${verificationId}` : "/admin/verifications";
    if (roles.isProvider) return "/provider/verification";
  }
  return null;
}

const METADATA_LABELS: Record<string, string> = {
  booking_id: "Booking",
  task_id: "Task",
  conversation_id: "Conversation",
  dispute_id: "Dispute",
  refund_id: "Refund",
  withdrawal_id: "Withdrawal",
  verification_id: "Verification",
  vendor_id: "Vendor",
  provider_id: "Provider",
  customer_id: "Customer",
  invoice_id: "Invoice",
  amount: "Amount",
  service_name: "Service",
  provider_name: "Provider",
};

export default function NotificationsPage() {
  const { user, hasRole } = useAuth();
  const { isStaff } = usePermission();
  const navigate = useNavigate();
  const roleFlags: RoleFlags = {
    isAdmin: hasRole("admin"),
    isProvider: hasRole("provider"),
    isStaff,
    isClient: hasRole("customer"),
  };
  const [detail, setDetail] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("notifications:activeTypes");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("notifications:activeTypes", JSON.stringify(activeTypes));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [activeTypes]);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [view, setView] = useState<"list" | "timeline">("list");
  const [search, setSearch] = useState("");
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


  const fetchReviewedBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("booking_id")
      .eq("customer_id", user.id);
    if (data) {
      setReviewedBookingIds(new Set(data.map((r) => r.booking_id)));
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (activeTypes.length > 0) {
      query = query.in("type", activeTypes);
    }
    if (readFilter === "unread") query = query.eq("is_read", false);
    if (readFilter === "read") query = query.eq("is_read", true);
    if (dateFrom) {
      query = query.gte("created_at", dateFrom.toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data } = await query.limit(100);
    if (data) setNotifications(data as unknown as Notification[]);
    setLoading(false);
  }, [user, activeTypes, dateFrom, dateTo, readFilter]);

  useEffect(() => {
    fetchNotifications();
    fetchReviewedBookings();
  }, [fetchNotifications, fetchReviewedBookings]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const toggleRead = async (n: Notification) => {
    const next = !n.is_read;
    await supabase.from("notifications").update({ is_read: next } as any).eq("id", n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: next } : x)));
  };

  const deleteNotification = async (id: string) => {
    const prev = notifications;
    setNotifications((p) => p.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setNotifications(prev);
      toast.error("Failed to delete");
    } else {
      toast.success("Notification deleted");
    }
  };

  const deleteAllRead = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id).eq("is_read", true);
    if (error) return toast.error("Failed to clear");
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    toast.success("Read notifications cleared");
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true } as any).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkMarkRead = async (nextValue: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prev = notifications;
    setNotifications((list) =>
      list.map((n) => (selectedIds.has(n.id) ? { ...n, is_read: nextValue } : n))
    );
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: nextValue } as any)
      .in("id", ids);
    if (error) {
      setNotifications(prev);
      toast.error("Failed to update selection");
      return;
    }
    toast.success(`${ids.length} marked as ${nextValue ? "read" : "unread"}`);
    clearSelection();
  };



  const toggleType = (type: string) => {
    setActiveTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const clearFilters = () => {
    setActiveTypes([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setReadFilter("all");
    setSearch("");
  };

  const hasFilters = activeTypes.length > 0 || dateFrom || dateTo || readFilter !== "all" || search.trim() !== "";

  // Client-side keyword / reference-ID search over the fetched list.
  const visibleNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((n) => {
      if (n.title?.toLowerCase().includes(q)) return true;
      if (n.message?.toLowerCase().includes(q)) return true;
      const meta = n.metadata ?? {};
      for (const v of Object.values(meta)) {
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
        if (typeof v === "number" && String(v).includes(q)) return true;
      }
      return false;
    });
  }, [notifications, search]);

  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; providerId: string } | null>(null);

  // Group notifications by day for timeline view
  const grouped = useMemo(() => {
    const map = new Map<number, { label: string; items: Notification[] }>();
    for (const n of visibleNotifications) {
      const d = startOfDay(new Date(n.created_at));
      const key = d.getTime();
      const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, MMM d, yyyy");
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(n);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]).map(([, v]) => v);
  }, [visibleNotifications]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(visibleNotifications, 15);

  useEffect(() => {
    setPage(1);
  }, [activeTypes, dateFrom, dateTo, view, readFilter, search, setPage]);

  return (
    <DashboardLayout
      title="Notifications"
      actions={
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-sm border border-border/60 p-0.5 bg-muted/30 text-sm">
            <button
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-fs-xs font-medium transition-colors",
                view === "list" ? "bg-background text-heading shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={view === "list"}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-fs-xs font-medium transition-colors",
                view === "timeline" ? "bg-background text-heading shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={view === "timeline"}
            >
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark all read ({unreadCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={deleteAllRead}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear read
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <Card className="p-4 mb-6 space-y-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by keyword or reference ID…"
            className="h-8 pl-8 pr-8 text-fs-xs"
            aria-label="Search notifications"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-sm border border-border/60 p-0.5 bg-muted/30 text-sm">
            {(["all", "unread", "read"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setReadFilter(k)}
                className={cn(
                  "px-2.5 py-1 rounded text-fs-xs font-medium capitalize transition-colors",
                  readFilter === k ? "bg-background text-heading shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "text-fs-xs h-8 gap-1.5",
                  activeTypes.length > 0 && "border-primary/30 text-primary"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Type
                {activeTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {activeTypes.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <span className="text-fs-xs font-semibold text-heading">Filter by type</span>
                {activeTypes.length > 0 && (
                  <button
                    onClick={() => setActiveTypes([])}
                    className="text-fs-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {NOTIFICATION_TYPES.map((t) => {
                  const active = activeTypes.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleType(t.value)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 text-fs-xs text-left transition-colors hover:bg-muted/60",
                        active && "bg-primary/[0.06]"
                      )}
                    >
                      <span className={cn("shrink-0", t.color)}>
                        <t.icon className="w-3.5 h-3.5" />
                      </span>
                      <span className={cn("flex-1", active ? "font-semibold text-heading" : "text-body")}>
                        {t.label}
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-6 w-px bg-border/50 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-fs-xs", dateFrom && "border-primary/30 text-primary")}>
                  {dateFrom ? format(dateFrom, "MMM d") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-fs-xs text-muted-foreground">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-fs-xs", dateTo && "border-primary/30 text-primary")}>
                  {dateTo ? format(dateTo, "MMM d") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-fs-xs text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Notification card renderer */}
      {(() => {
        const renderCard = (n: Notification, opts?: { compact?: boolean }) => {
          const config = typeMap[n.type] || typeMap.info;
          const Icon = config.icon;
          const selected = selectedIds.has(n.id);
          return (
            <Card
              key={n.id}
              className={cn(
                "flex items-start gap-4 transition-colors cursor-pointer hover:bg-muted/30",
                opts?.compact ? "p-3" : "p-4",
                !n.is_read && "bg-primary/[0.02] border-primary/10",
                selected && "ring-1 ring-primary/40 bg-primary/[0.04]"
              )}
              onClick={() => {
                if (!n.is_read) markAsRead(n.id);
                setDetail(n);
              }}
            >
              <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleSelect(n.id)}
                  aria-label={`Select notification ${n.title}`}
                />
              </div>
              <div className={cn("mt-0.5 shrink-0", config.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("text-fs-sm leading-snug", !n.is_read ? "font-semibold text-heading" : "text-body")}>
                    {n.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRead(n); }}
                      className="text-muted-foreground/60 hover:text-foreground"
                      aria-label={n.is_read ? "Mark as unread" : "Mark as read"}
                      title={n.is_read ? "Mark as unread" : "Mark as read"}
                    >
                      {n.is_read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="text-muted-foreground/60 hover:text-destructive"
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-fs-sm text-muted-foreground mt-1">{n.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-fs-xs text-muted-foreground/60">
                    {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                  {n.type === "review_reminder" && n.metadata?.booking_id && !reviewedBookingIds.has(n.metadata.booking_id as string) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-fs-xs px-2.5 gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.is_read) markAsRead(n.id);
                        setReviewTarget({
                          bookingId: n.metadata.booking_id as string,
                          providerId: n.metadata.vendor_id as string,
                        });
                      }}
                    >
                      <Star className="w-3.5 h-3.5" />
                      Leave Review
                    </Button>
                  )}
                </div>
                {n.type === "review_received" && n.metadata?.booking_id && (
                  <ProviderReplyInline bookingId={n.metadata.booking_id as string} />
                )}
              </div>
            </Card>
          );
        };

        if (loading) {
          return (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 rounded-sm bg-muted/50 animate-pulse" />
              ))}
            </div>
          );
        }

        if (visibleNotifications.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-fs-sm text-muted-foreground">
                {hasFilters ? "No notifications match your filters." : "No notifications yet."}
              </p>
            </div>
          );
        }

        const pageIds = pageItems.map((n) => n.id);
        const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
        const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));
        const togglePageSelection = () => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
            else pageIds.forEach((id) => next.add(id));
            return next;
          });
        };

        const bulkBar = (
          <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-sm border border-border/60 bg-muted/30">
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                onCheckedChange={togglePageSelection}
                aria-label="Select all on this page"
              />
              <span className="text-fs-xs text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select all on page (${pageIds.length})`}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-fs-xs"
                disabled={selectedIds.size === 0}
                onClick={() => bulkMarkRead(true)}
              >
                <MailOpen className="w-3.5 h-3.5 mr-1.5" />
                Mark read
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-fs-xs"
                disabled={selectedIds.size === 0}
                onClick={() => bulkMarkRead(false)}
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Mark unread
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-fs-xs text-muted-foreground"
                  onClick={clearSelection}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        );

        if (view === "list") {
          return (
            <>
              {bulkBar}
              <div className="space-y-2">{pageItems.map((n) => renderCard(n))}</div>
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                pageSize={pageSize}
                className="mt-4"
          onPageSizeChange={setPageSize}
              />
            </>
          );
        }

        // Timeline view — grouped by day with a vertical rail
        return (
          <>
            {bulkBar}
            <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/50">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-fs-xs font-semibold text-heading">{group.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">· {group.items.length}</span>
                  </div>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-border/50" aria-hidden />
                  <div className="space-y-2">
                    {group.items.map((n) => {
                      const config = typeMap[n.type] || typeMap.info;
                      return (
                        <div key={n.id} className="relative">
                          <span
                            className={cn(
                              "absolute -left-[18px] top-5 w-2.5 h-2.5 rounded-full ring-2 ring-background",
                              n.is_read ? "bg-muted-foreground/40" : "bg-primary",
                              config.color.replace("text-", "bg-").includes("amber") && !n.is_read && "bg-amber-500",
                              config.color.replace("text-", "bg-").includes("destructive") && !n.is_read && "bg-destructive",
                              config.color.replace("text-", "bg-").includes("blue") && !n.is_read && "bg-blue-500",
                            )}
                            aria-hidden
                          />
                          {renderCard(n, { compact: true })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
            </div>
          </>
        );
      })()}

      {reviewTarget && (
        <LeaveReviewModal
          open={!!reviewTarget}
          onOpenChange={(v) => !v && setReviewTarget(null)}
          bookingId={reviewTarget.bookingId}
          providerId={reviewTarget.providerId}
          onReviewSubmitted={() => { fetchNotifications(); fetchReviewedBookings(); }}
        />
      )}

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          {detail && (() => {
            const cfg = typeMap[detail.type] || typeMap.info;
            const DetailIcon = cfg.icon;
            const link = resolveNotificationLink(detail, roleFlags);
            const meta = detail.metadata ?? {};
            const metaEntries = Object.entries(meta).filter(
              ([k, v]) => v !== null && v !== undefined && v !== "" && k !== "event" && k !== "link" && k !== "url"
            );
            return (
              <>
                <SheetHeader className="text-left space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-1 shrink-0", cfg.color)}>
                      <DetailIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="mb-1.5 text-[10px] px-1.5 py-0">
                        {cfg.label}
                      </Badge>
                      <SheetTitle className="text-fs-base leading-snug">{detail.title}</SheetTitle>
                      <SheetDescription className="text-fs-xs text-muted-foreground mt-1">
                        {format(new Date(detail.created_at), "EEE, MMM d, yyyy · h:mm a")} ·{" "}
                        {formatDistanceToNow(new Date(detail.created_at), { addSuffix: true })}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  <p className="text-fs-sm text-body leading-relaxed whitespace-pre-wrap">
                    {detail.message}
                  </p>

                  {metaEntries.length > 0 && (
                    <div className="rounded-sm border border-border/60 bg-muted/20 divide-y divide-border/40">
                      {metaEntries.map(([k, v]) => {
                        const label = METADATA_LABELS[k] ?? k.replace(/_/g, " ");
                        const str = typeof v === "object" ? JSON.stringify(v) : String(v);
                        const isId = k.endsWith("_id");
                        return (
                          <div key={k} className="flex items-start gap-3 px-3 py-2 text-fs-xs">
                            <span className="text-muted-foreground capitalize min-w-[90px]">{label}</span>
                            <span className={cn("flex-1 text-body break-all", isId && "font-mono text-[11px]")}>
                              {str}
                            </span>
                            {isId && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(str);
                                  toast.success("Copied");
                                }}
                                className="text-muted-foreground/60 hover:text-foreground shrink-0"
                                aria-label={`Copy ${label}`}
                                title="Copy"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {detail.type === "review_received" && detail.metadata?.booking_id && (
                    <ProviderReplyInline bookingId={detail.metadata.booking_id as string} />
                  )}
                </div>

                <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-start border-t border-border/50 pt-3">
                  {link && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setDetail(null);
                        navigate(link);
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Open
                    </Button>
                  )}
                  {detail.type === "review_reminder" &&
                    detail.metadata?.booking_id &&
                    !reviewedBookingIds.has(detail.metadata.booking_id as string) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewTarget({
                            bookingId: detail.metadata.booking_id as string,
                            providerId: detail.metadata.vendor_id as string,
                          });
                          setDetail(null);
                        }}
                      >
                        <Star className="w-3.5 h-3.5 mr-1.5" />
                        Leave Review
                      </Button>
                    )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toggleRead(detail);
                      setDetail({ ...detail, is_read: !detail.is_read });
                    }}
                  >
                    {detail.is_read ? (
                      <>
                        <Mail className="w-3.5 h-3.5 mr-1.5" /> Mark unread
                      </>
                    ) : (
                      <>
                        <MailOpen className="w-3.5 h-3.5 mr-1.5" /> Mark read
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      deleteNotification(detail.id);
                      setDetail(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                </SheetFooter>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
