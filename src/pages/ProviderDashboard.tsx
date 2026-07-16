import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startOfToday, isAfter, isSameDay, addDays, startOfWeek, endOfWeek, subWeeks, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { CalendarCheck, Settings } from "lucide-react";
import { notifyBookingTransition } from "@/lib/notifications";


import ProviderStatsCards from "@/components/provider/dashboard/ProviderStatsCards";
import PendingRequests from "@/components/provider/dashboard/PendingRequests";
import UpcomingJobs from "@/components/provider/dashboard/UpcomingJobs";
import WeeklyEarningsChart from "@/components/provider/dashboard/WeeklyEarningsChart";
import ReviewsSummary from "@/components/provider/dashboard/ReviewsSummary";
import ProfileCompletion from "@/components/provider/dashboard/ProfileCompletion";
import ScheduleWidget from "@/components/provider/dashboard/ScheduleWidget";
import EarningsSummaryWidget from "@/components/provider/dashboard/EarningsSummaryWidget";
import WithdrawalsWidget from "@/components/provider/dashboard/WithdrawalsWidget";
import ProviderQuickActions from "@/components/provider/dashboard/ProviderQuickActions";
import MonthlyEarningsChart from "@/components/provider/dashboard/MonthlyEarningsChart";
import BookingConversionWidget from "@/components/provider/dashboard/BookingConversionWidget";
import VerificationBanner from "@/components/provider/VerificationBanner";
import PendingApplicationsWidget from "@/components/provider/dashboard/PendingApplicationsWidget";
import SubscriptionStatusWidget from "@/components/provider/dashboard/SubscriptionStatusWidget";
import NotificationsWidget from "@/components/provider/dashboard/NotificationsWidget";
import type { ProviderBooking, ProviderReview } from "@/components/provider/dashboard/types";
import { LoadingState } from "@/components/ui/app";

const ProviderDashboard = () => {
  const { user, profile } = useAuth();
  
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [servicesCount, setServicesCount] = useState(0);
  const [commissionType, setCommissionType] = useState("percentage");
  const [commissionValue, setCommissionValue] = useState(10);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [proposals, setProposals] = useState<Array<{ status: string }>>([]);
  const [subscription, setSubscription] = useState<{ status: string; current_period_end: string; plan: { name: string } | null } | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string | null; created_at: string; read_at: string | null }>>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const bookingsQuery = supabase
        .from("bookings")
        .select("id, status, booking_date, total_price, start_time, end_time, created_at, payment_status, service:vendor_services(title), customer_id")
        .order("created_at", { ascending: false });
      const reviewsQuery = supabase
        .from("reviews")
        .select("rating, comment, created_at, customer_id, vendor_reply, vendor_id")
        .order("created_at", { ascending: false });

      bookingsQuery.eq("vendor_id", user.id);
      reviewsQuery.eq("vendor_id", user.id);


      const [bookingsRes, reviewsRes, availRes, portfolioRes, servicesRes, proposalsRes, subRes, notifRes] =
        await Promise.all([
          bookingsQuery,
          reviewsQuery,
          supabase.from("vendor_availability").select("*").eq("vendor_id", user.id),
          supabase.from("vendor_portfolio").select("id").eq("vendor_id", user.id),
          supabase.from("vendor_services").select("id").eq("vendor_id", user.id).eq("is_active", true),
          supabase.from("task_proposals").select("status").eq("vendor_id", user.id).in("status", ["pending", "shortlisted"]),
          supabase
            .from("provider_subscriptions")
            .select("status, current_period_end, plan:subscription_plans(name)")
            .eq("provider_id", user.id)
            .order("current_period_end", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("notifications")
            .select("id, title, message, created_at, read_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      setBookings((bookingsRes.data as any) || []);
      setReviews((reviewsRes.data as any) || []);
      setPortfolioCount((portfolioRes.data || []).length);
      setServicesCount((servicesRes.data || []).length);
      setIsOnline((availRes.data || []).length > 0);
      setProposals((proposalsRes.data as any) || []);
      setSubscription((subRes?.data as any) || null);
      setNotifications((notifRes.data as any) || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  /* ─── Derived data ─── */
  const today = startOfToday();
  const completed = bookings.filter((b) => b.status === "completed");
  const calcComm = (price: number) =>
    commissionType === "percentage" ? price * (commissionValue / 100) : commissionValue;
  const totalGross = completed.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalNet = totalGross - completed.reduce((s, b) => s + calcComm(b.total_price || 0), 0);

  const pendingRequests = bookings.filter((b) => b.status === "pending");
  const acceptedBookings = bookings.filter((b) => ["accepted", "confirmed", "in_progress"].includes(b.status));
  const upcomingBookings = acceptedBookings
    .filter((b) => isAfter(new Date(b.booking_date + "T23:59:59"), today))
    .sort((a, b) => new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime());

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  const weeklyData = useMemo(() => {
    const result: { week: string; earnings: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = startOfWeek(subWeeks(new Date(), i));
      const we = endOfWeek(ws);
      const earnings = completed
        .filter((b) => { const d = new Date(b.created_at); return d >= ws && d <= we; })
        .reduce((s, b) => s + (b.total_price || 0), 0);
      result.push({ week: `W${4 - i}`, earnings });
    }
    return result;
  }, [completed]);

  const monthlyData = useMemo(() => {
    const result: { month: string; earnings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ms = startOfMonth(subMonths(new Date(), i));
      const me = endOfMonth(ms);
      const earnings = completed
        .filter((b) => { const d = new Date(b.created_at); return d >= ms && d <= me; })
        .reduce((s, b) => s + (b.total_price || 0), 0);
      result.push({ month: format(ms, "MMM"), earnings });
    }
    return result;
  }, [completed]);

  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const totalBookingRequests = bookings.length;

  const next7Days = useMemo(() => {
    const days: { date: Date; bookings: ProviderBooking[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const dayBookings = bookings.filter(
        (b) => ["accepted", "confirmed", "in_progress"].includes(b.status) && isSameDay(new Date(b.booking_date + "T00:00:00"), d)
      );
      days.push({ date: d, bookings: dayBookings });
    }
    return days;
  }, [bookings, today]);

  /* ─── Booking actions ─── */
  const refreshBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select("id, status, booking_date, total_price, start_time, end_time, created_at, payment_status, service:vendor_services(title), customer_id")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    setBookings((data as any) || []);
  }, [user]);

  const handleAccept = async (id: string) => {
    const booking = bookings.find((b) => b.id === id);
    const { error } = await supabase.from("bookings").update({ status: "accepted" }).eq("id", id);
    if (error) { toast.error("Failed to accept"); return; }
    toast.success("Booking accepted");
    if (booking && user) {
      await notifyBookingTransition("accepted", {
        bookingId: id,
        customerId: booking.customer_id,
        vendorId: user.id,
        actorId: user.id,
        providerName: profile?.display_name || "Your provider",
        bookingDate: booking.booking_date,
        serviceName: (booking as any).service?.title,
      });
    }
    refreshBookings();
  };

  const handleDecline = async (id: string) => {
    const booking = bookings.find((b) => b.id === id);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error("Failed to decline"); return; }
    toast.success("Booking declined");
    if (booking && user) {
      await notifyBookingTransition("rejected", {
        bookingId: id,
        customerId: booking.customer_id,
        vendorId: user.id,
        actorId: user.id,
        providerName: profile?.display_name || "Your provider",
        bookingDate: booking.booking_date,
        serviceName: (booking as any).service?.title,
      });
    }
    refreshBookings();
  };

  /* ─── Realtime ─── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("vendor-bookings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `vendor_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          toast("New booking request!", { description: "A customer just booked your service.", icon: <CalendarCheck className="w-4 h-4 text-primary" /> });
        } else if (payload.eventType === "UPDATE" && (payload.new as any)?.status === "completed") {
          toast.success("A booking was marked as completed!");
        }
        refreshBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refreshBookings]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <DashboardLayout
      title={`${greeting}, ${profile?.display_name?.split(" ")[0] || "Pro"}!`}
      subtitle="Here's your business overview at a glance."
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
            <span className={cn("text-fs-xs font-medium", isOnline ? "text-primary" : "text-muted-foreground")}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <Link to="/provider-profile">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Settings className="w-4 h-4" /> Settings
            </Button>
          </Link>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="section" />
      ) : (
        <div className="space-y-6">
          <VerificationBanner />
          <ProviderStatsCards totalNet={totalNet} pendingCount={pendingRequests.length} activeCount={acceptedBookings.length} avgRating={avgRating} />

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <PendingRequests bookings={pendingRequests} onAccept={handleAccept} onDecline={handleDecline} />
              <UpcomingJobs bookings={upcomingBookings} />
              <WeeklyEarningsChart data={weeklyData} />
              <MonthlyEarningsChart data={monthlyData} />
              <ReviewsSummary reviews={reviews} avgRating={avgRating} />
            </div>

            <div className="space-y-6">
              <ProfileCompletion profile={profile} servicesCount={servicesCount} portfolioCount={portfolioCount} />
              <SubscriptionStatusWidget
                planName={subscription?.plan?.name}
                status={subscription?.status}
                periodEnd={subscription?.current_period_end}
              />
              <PendingApplicationsWidget
                count={proposals.length}
                shortlisted={proposals.filter((p) => p.status === "shortlisted").length}
              />
              <NotificationsWidget
                notifications={notifications}
                unreadCount={notifications.filter((n) => !n.read_at).length}
              />
              <BookingConversionWidget
                totalRequests={totalBookingRequests}
                completedCount={completed.length}
                acceptedCount={acceptedBookings.length}
                cancelledCount={cancelledCount}
              />
              <ScheduleWidget days={next7Days} />
              <EarningsSummaryWidget
                totalNet={totalNet}
                totalGross={totalGross}
                totalCommission={totalGross - totalNet}
                commissionType={commissionType}
                commissionValue={commissionValue}
                completedCount={completed.length}
              />
              <WithdrawalsWidget balance={totalNet} />
              <ProviderQuickActions userId={user?.id} />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ProviderDashboard;
