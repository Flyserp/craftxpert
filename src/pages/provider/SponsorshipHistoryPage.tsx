import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageShell from "@/components/layouts/PageShell";
import { AppCard, LoadingState, EmptyState } from "@/components/ui/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles, Calendar, DollarSign, Clock, RefreshCw, Plus, Star,
  CalendarCheck, Heart, TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNowStrict, differenceInDays } from "date-fns";
import SponsorServiceDialog from "@/components/provider/SponsorServiceDialog";

interface Order {
  id: string;
  service_id: string;
  days: number;
  amount: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  vendor_services?: { title: string } | null;
}

interface Service {
  id: string;
  title: string;
  is_sponsored: boolean;
  sponsored_until: string | null;
  sponsored_started_at: string | null;
  is_active: boolean;
}

interface Metric {
  bookings: number;
  reviews: number;
  avgRating: number;
  favorites: number;
}

export default function SponsorshipHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [loading, setLoading] = useState(true);
  const [sponsorTarget, setSponsorTarget] = useState<Service | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [ordersRes, servicesRes] = await Promise.all([
      supabase
        .from("sponsorship_orders")
        .select("*, vendor_services(title)")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("vendor_services")
        .select("id, title, is_sponsored, sponsored_until, sponsored_started_at, is_active")
        .eq("vendor_id", user.id),
    ]);
    const svc = (servicesRes.data || []) as Service[];
    setOrders((ordersRes.data || []) as Order[]);
    setServices(svc);

    const sponsoredIds = svc.filter((s) => s.is_sponsored).map((s) => s.id);
    if (sponsoredIds.length) {
      const sb: any = supabase;
      const bookingsRes: any = await sb.from("bookings").select("service_id").in("service_id", sponsoredIds);
      const reviewsRes: any = await sb.from("reviews").select("service_id, rating").in("service_id", sponsoredIds);
      const favoritesRes: any = await sb.from("favorites").select("vendor_id").eq("vendor_id", user.id);
      const m: Record<string, Metric> = {};
      sponsoredIds.forEach((id) => (m[id] = { bookings: 0, reviews: 0, avgRating: 0, favorites: 0 }));
      (bookingsRes.data || []).forEach((b: any) => {
        if (m[b.service_id]) m[b.service_id].bookings += 1;
      });
      const ratingSum: Record<string, { sum: number; n: number }> = {};
      (reviewsRes.data || []).forEach((r: any) => {
        if (!m[r.service_id]) return;
        m[r.service_id].reviews += 1;
        ratingSum[r.service_id] ||= { sum: 0, n: 0 };
        ratingSum[r.service_id].sum += Number(r.rating || 0);
        ratingSum[r.service_id].n += 1;
      });
      Object.entries(ratingSum).forEach(([id, v]) => {
        m[id].avgRating = v.n ? v.sum / v.n : 0;
      });
      const favCount = (favoritesRes.data || []).length;
      sponsoredIds.forEach((id) => (m[id].favorites = favCount));
      setMetrics(m);
    } else {
      setMetrics({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const activeListings = useMemo(
    () => services.filter((s) => s.is_sponsored && s.sponsored_until && new Date(s.sponsored_until) > new Date()),
    [services]
  );
  const eligibleServices = useMemo(
    () => services.filter((s) => s.is_active && (!s.is_sponsored || (s.sponsored_until && new Date(s.sponsored_until) <= new Date()))),
    [services]
  );

  const totalSpent = orders.filter((o) => o.status !== "rejected" && o.status !== "cancelled").reduce((s, o) => s + Number(o.amount), 0);

  const renderExpiry = (until: string) => {
    const days = differenceInDays(new Date(until), new Date());
    const urgent = days <= 3;
    return (
      <div className={`flex items-center gap-1.5 text-fs-xs ${urgent ? "text-rose-600" : "text-muted-foreground"}`}>
        <Clock className="w-3.5 h-3.5" />
        Expires {formatDistanceToNowStrict(new Date(until), { addSuffix: true })} · {format(new Date(until), "MMM d")}
      </div>
    );
  };

  const headerActions = (
    <Button onClick={() => setPickerOpen(true)} className="gap-1.5">
      <Plus className="w-4 h-4" /> Sponsor a service
    </Button>
  );

  return (
    <PageShell
      title="Sponsored Services"
      description="Boost visibility, renew active sponsorships, and track performance."
      actions={headerActions}
    >
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <AppCard className="p-4">
              <div className="flex items-center gap-2 text-fs-xs text-muted-foreground"><Sparkles className="w-3.5 h-3.5" /> Active</div>
              <p className="text-fs-xl font-semibold mt-1">{activeListings.length}</p>
            </AppCard>
            <AppCard className="p-4">
              <div className="flex items-center gap-2 text-fs-xs text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> Total orders</div>
              <p className="text-fs-xl font-semibold mt-1">{orders.length}</p>
            </AppCard>
            <AppCard className="p-4">
              <div className="flex items-center gap-2 text-fs-xs text-muted-foreground"><DollarSign className="w-3.5 h-3.5" /> Total spent</div>
              <p className="text-fs-xl font-semibold mt-1">${totalSpent.toFixed(2)}</p>
            </AppCard>
            <AppCard className="p-4">
              <div className="flex items-center gap-2 text-fs-xs text-muted-foreground"><CalendarCheck className="w-3.5 h-3.5" /> Bookings (sponsored)</div>
              <p className="text-fs-xl font-semibold mt-1">
                {Object.values(metrics).reduce((s, m) => s + m.bookings, 0)}
              </p>
            </AppCard>
          </div>

          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active listings</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="history">Payment history</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeListings.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No active sponsorships"
                  description="Sponsor a service to appear at the top of search and category listings."
                />
              ) : (
                <div className="space-y-2">
                  {activeListings.map((s) => (
                    <AppCard key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-heading truncate">{s.title}</p>
                            <Badge className="bg-accent/15 text-primary border-accent/30">Sponsored</Badge>
                          </div>
                          {s.sponsored_until && (
                            <div className="mt-1 space-y-0.5">
                              {renderExpiry(s.sponsored_until)}
                              {s.sponsored_started_at && (
                                <p className="text-fs-xs text-muted-foreground">
                                  Started {format(new Date(s.sponsored_started_at), "MMM d, yyyy")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setSponsorTarget(s)} className="gap-1.5">
                          <RefreshCw className="w-4 h-4" /> Renew
                        </Button>
                      </div>
                    </AppCard>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="mt-4">
              {activeListings.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No metrics yet" description="Start a sponsorship to see performance data." />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {activeListings.map((s) => {
                    const m = metrics[s.id] || { bookings: 0, reviews: 0, avgRating: 0, favorites: 0 };
                    return (
                      <AppCard key={s.id} className="p-4">
                        <p className="font-semibold text-heading truncate">{s.title}</p>
                        {s.sponsored_until && <div className="mt-1">{renderExpiry(s.sponsored_until)}</div>}
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <Stat icon={CalendarCheck} label="Bookings" value={m.bookings.toString()} />
                          <Stat icon={Star} label="Rating" value={m.avgRating ? m.avgRating.toFixed(1) : "—"} sub={`${m.reviews} reviews`} />
                          <Stat icon={Heart} label="Favorites" value={m.favorites.toString()} />
                        </div>
                      </AppCard>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {orders.length === 0 ? (
                <EmptyState icon={DollarSign} title="No payments yet" description="Your sponsorship payments will appear here." />
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => {
                    const active = o.status === "active" && new Date(o.ends_at) > new Date();
                    return (
                      <AppCard key={o.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-heading">{o.vendor_services?.title || "Service"}</p>
                            <p className="text-fs-xs text-muted-foreground mt-0.5">
                              {format(new Date(o.starts_at), "MMM d, yyyy")} → {format(new Date(o.ends_at), "MMM d, yyyy")} · {o.days} days
                            </p>
                            <p className="text-fs-xs text-muted-foreground">
                              Purchased {format(new Date(o.created_at), "MMM d, yyyy 'at' HH:mm")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-heading">${Number(o.amount).toFixed(2)}</p>
                            <Badge variant={active ? "default" : "secondary"} className="mt-1 capitalize">
                              {active ? "Active" : o.status}
                            </Badge>
                          </div>
                        </div>
                      </AppCard>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Service picker for new sponsorships */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a service to sponsor</DialogTitle>
            <DialogDescription>Pick one of your active services.</DialogDescription>
          </DialogHeader>
          {eligibleServices.length === 0 ? (
            <p className="text-fs-sm text-muted-foreground">
              You don't have any eligible services. Create or activate a service first.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {eligibleServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSponsorTarget(s); setPickerOpen(false); }}
                  className="w-full text-left rounded-md border border-border px-3 py-2 hover:border-primary/40 transition"
                >
                  <p className="font-medium text-heading truncate">{s.title}</p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SponsorServiceDialog
        open={!!sponsorTarget}
        serviceId={sponsorTarget?.id ?? null}
        serviceTitle={sponsorTarget?.title}
        currentSponsoredUntil={sponsorTarget?.sponsored_until ?? null}
        onClose={() => setSponsorTarget(null)}
        onDone={load}
      />
    </PageShell>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center gap-1.5 text-fs-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-fs-lg font-semibold mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}