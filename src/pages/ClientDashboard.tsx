import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import ProfileRail from "@/components/client/dashboard/ProfileRail";
import StatCardsRow from "@/components/client/dashboard/StatCardsRow";
import RecentTransactions, { type UnifiedTx } from "@/components/client/dashboard/RecentTransactions";
import RecentBookingsGrid, { type RecentBookingItem } from "@/components/client/dashboard/RecentBookingsGrid";
import {
  FavoritesWidget,
  MessagesWidget,
  ReviewsWidget,
  NotificationsWidget,
} from "@/components/client/dashboard/DashboardWidgets";

interface BookingRow {
  id: string;
  vendor_id: string;
  service_id: string;
  booking_date: string;
  status: string;
  total_price: number | null;
  discount_amount: number | null;
  created_at: string;
}
interface PaymentTxRow {
  id: string; amount: number; payment_type: string; status: string;
  created_at: string; vendor_id: string; booking_id: string | null;
}
interface WalletTxRow {
  id: string; amount: number; type: string; description: string | null; created_at: string;
}

const TX_LABEL: Record<string, string> = {
  booking: "Service Booking",
  refund: "Service Refund",
  topup: "Wallet Topup",
  withdrawal: "Wallet Withdrawal",
  wallet: "Wallet Transaction",
};

function classifyPayment(t: PaymentTxRow): UnifiedTx {
  const isRefund = t.payment_type === "refund" || t.amount < 0;
  return {
    id: `p-${t.id}`,
    kind: isRefund ? "refund" : "booking",
    label: isRefund ? TX_LABEL.refund : TX_LABEL.booking,
    amount: isRefund ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount)),
    created_at: t.created_at,
  };
}
function classifyWallet(t: WalletTxRow): UnifiedTx {
  const kind: UnifiedTx["kind"] =
    t.type === "top_up" ? "topup"
    : t.type === "refund" ? "refund"
    : t.type === "withdrawal" ? "withdrawal"
    : "wallet";
  return {
    id: `w-${t.id}`,
    kind,
    label: kind === "topup" ? TX_LABEL.topup
         : kind === "refund" ? TX_LABEL.refund
         : kind === "withdrawal" ? TX_LABEL.withdrawal
         : (t.description || TX_LABEL.wallet),
    amount: Number(t.amount),
    created_at: t.created_at,
  };
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const ClientDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [bookingsAll, setBookingsAll] = useState<BookingRow[]>([]);
  const [recentBookings, setRecentBookings] = useState<RecentBookingItem[]>([]);
  const [transactions, setTransactions] = useState<UnifiedTx[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null }>>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [messages, setMessages] = useState<Array<{ id: string; body: string | null; created_at: string; sender_name?: string | null }>>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [myReviews, setMyReviews] = useState<Array<{ id: string; rating: number; comment: string | null; created_at: string }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; created_at: string; read_at: string | null }>>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [bookingsRes, walletRes, paymentsRes, walletTxRes, profileRes, favoritesRes, reviewsRes, notifRes, messagesRes] = await Promise.all([
        supabase.from("bookings")
          .select("id, vendor_id, service_id, booking_date, status, total_price, discount_amount, created_at")
          .eq("customer_id", user.id)
          .order("booking_date", { ascending: false }),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("payment_transactions")
          .select("id, amount, payment_type, status, created_at, vendor_id, booking_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("wallet_transactions")
          .select("id, amount, type, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("profiles").select("created_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("favorites").select("vendor_id").eq("user_id", user.id),
        supabase.from("reviews")
          .select("id, rating, comment, created_at")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("notifications")
          .select("id, title, created_at, read_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("messages")
          .select("id, content, created_at, sender_id, is_read")
          .neq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled) return;

      const bookings = (bookingsRes.data || []) as BookingRow[];
      setBookingsAll(bookings);
      setWalletBalance(Number(walletRes.data?.balance ?? 0));
      setMemberSince(profileRes.data?.created_at ?? null);
      setMyReviews((reviewsRes.data as any) || []);
      setNotifications((notifRes.data as any) || []);

      const favRows = (favoritesRes.data as Array<{ vendor_id: string }>) || [];
      setFavoritesCount(favRows.length);
      const favIds = favRows.slice(0, 4).map((f) => f.vendor_id);
      if (favIds.length > 0) {
        const favProfiles = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", favIds);
        setFavorites((favProfiles.data || []).map((p) => ({
          id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url,
        })));
      } else {
        setFavorites([]);
      }

      const msgRows = (messagesRes.data as Array<{ id: string; content: string | null; created_at: string; sender_id: string; is_read: boolean }>) || [];
      setUnreadMessages(msgRows.filter((m) => !m.is_read).length);
      const senderIds = [...new Set(msgRows.map((m) => m.sender_id))];
      let senderMap = new Map<string, string>();
      if (senderIds.length > 0) {
        const sp = await supabase.from("profiles").select("user_id, display_name").in("user_id", senderIds);
        senderMap = new Map((sp.data || []).map((s) => [s.user_id, s.display_name || "Provider"]));
      }
      setMessages(msgRows.slice(0, 3).map((m) => ({
        id: m.id, body: m.content, created_at: m.created_at, sender_name: senderMap.get(m.sender_id) || "Provider",
      })));

      // Merged transactions feed
      const merged: UnifiedTx[] = [
        ...(paymentsRes.data || []).map((p) => classifyPayment(p as PaymentTxRow)),
        ...(walletTxRes.data || []).map((w) => classifyWallet(w as WalletTxRow)),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(merged);

      // Recent bookings: enrich top 6 with vendor profile + service title + cover
      const top = bookings.slice(0, 6);
      if (top.length > 0) {
        const vendorIds = [...new Set(top.map((b) => b.vendor_id))];
        const serviceIds = [...new Set(top.map((b) => b.service_id))];
        const [vendorsRes, servicesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", vendorIds),
          supabase.from("vendor_services").select("id, title").in("id", serviceIds),
        ]);
        // Pull a cover image from each vendor's portfolio (first image)
        const portfolioRes = await supabase
          .from("vendor_portfolio")
          .select("vendor_id, image_url, sort_order")
          .in("vendor_id", vendorIds)
          .order("sort_order", { ascending: true });

        const vMap = new Map((vendorsRes.data || []).map((v) => [v.user_id, v]));
        const sMap = new Map((servicesRes.data || []).map((s) => [s.id, s.title]));
        const coverMap = new Map<string, string>();
        for (const p of (portfolioRes.data || [])) {
          if (!coverMap.has(p.vendor_id)) coverMap.set(p.vendor_id, p.image_url);
        }

        setRecentBookings(top.map((b) => {
          const vp = vMap.get(b.vendor_id);
          return {
            id: b.id,
            service_title: sMap.get(b.service_id) || "Service",
            vendor_id: b.vendor_id,
            vendor_name: vp?.display_name || "Provider",
            vendor_avatar: vp?.avatar_url || null,
            cover_image: coverMap.get(b.vendor_id) || null,
            booking_date: b.booking_date,
          };
        }));
      } else {
        setRecentBookings([]);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Derived KPIs (with month-over-month deltas) ─────────────────
  const { totalOrders, totalSpend, totalSavings, deltas } = useMemo(() => {
    const now = new Date();
    const startOfThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const completed = bookingsAll.filter((b) => b.status === "completed");
    const totalOrders = bookingsAll.length;
    const totalSpend = completed.reduce((s, b) => s + Number(b.total_price ?? 0), 0);
    const totalSavings = completed.reduce((s, b) => s + Number(b.discount_amount ?? 0), 0);

    const inThis = (d: string) => new Date(d) >= startOfThis;
    const inPrev = (d: string) => new Date(d) >= startOfPrev && new Date(d) < startOfThis;

    const ordersThis = bookingsAll.filter((b) => inThis(b.created_at)).length;
    const ordersPrev = bookingsAll.filter((b) => inPrev(b.created_at)).length;
    const spendThis = completed.filter((b) => inThis(b.created_at)).reduce((s, b) => s + Number(b.total_price ?? 0), 0);
    const spendPrev = completed.filter((b) => inPrev(b.created_at)).reduce((s, b) => s + Number(b.total_price ?? 0), 0);
    const savingsThis = completed.filter((b) => inThis(b.created_at)).reduce((s, b) => s + Number(b.discount_amount ?? 0), 0);
    const savingsPrev = completed.filter((b) => inPrev(b.created_at)).reduce((s, b) => s + Number(b.discount_amount ?? 0), 0);

    const walletInThis = transactions
      .filter((t) => t.kind === "topup" && inThis(t.created_at))
      .reduce((s, t) => s + t.amount, 0);
    const walletInPrev = transactions
      .filter((t) => t.kind === "topup" && inPrev(t.created_at))
      .reduce((s, t) => s + t.amount, 0);

    return {
      totalOrders, totalSpend, totalSavings,
      deltas: {
        orders: pctChange(ordersThis, ordersPrev),
        spend: pctChange(spendThis, spendPrev),
        wallet: pctChange(walletInThis, walletInPrev),
        savings: pctChange(savingsThis, savingsPrev),
      },
    };
  }, [bookingsAll, transactions]);

  return (
    <DashboardLayout title="Dashboard" subtitle="Customer › Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Left rail */}
        <ProfileRail memberSince={memberSince} />

        {/* Main content */}
        <div className="space-y-6 min-w-0">
          <StatCardsRow
            totalOrders={totalOrders}
            totalSpend={totalSpend}
            walletBalance={walletBalance}
            totalSavings={totalSavings}
            ordersDelta={deltas.orders}
            spendDelta={deltas.spend}
            walletDelta={deltas.wallet}
            savingsDelta={deltas.savings}
          />
          <RecentTransactions transactions={transactions} loading={loading} />
          <RecentBookingsGrid bookings={recentBookings} loading={loading} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FavoritesWidget items={favorites} total={favoritesCount} />
            <MessagesWidget messages={messages} unread={unreadMessages} />
            <ReviewsWidget reviews={myReviews} />
            <NotificationsWidget items={notifications} unread={notifications.filter((n) => !n.read_at).length} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDashboard;
