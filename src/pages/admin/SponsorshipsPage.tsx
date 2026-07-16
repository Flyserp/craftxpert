import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, AppCard, LoadingState, EmptyState } from "@/components/ui/app";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Search, Check, X, Play, Pause, CalendarPlus, DollarSign, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type OrderStatus = "pending" | "active" | "rejected" | "cancelled" | "expired" | string;

interface SponsorOrder {
  id: string;
  vendor_id: string;
  service_id: string;
  days: number;
  amount: number;
  starts_at: string;
  ends_at: string;
  status: OrderStatus;
  created_at: string;
  vendor_services?: { id: string; title: string; is_sponsored: boolean; sponsored_until: string | null } | null;
  vendor?: { display_name: string | null; business_name: string | null } | null;
}

type FilterKey = "all" | "pending" | "active" | "expired";

export default function AdminSponsorshipsPage() {
  const [orders, setOrders] = useState<SponsorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [extendOpen, setExtendOpen] = useState<SponsorOrder | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: orderRows } = await supabase
      .from("sponsorship_orders")
      .select("*, vendor_services(id, title, is_sponsored, sponsored_until)")
      .order("created_at", { ascending: false })
      .limit(500);
    const vendorIds = Array.from(new Set((orderRows || []).map((o: any) => o.vendor_id)));
    let vendorMap = new Map<string, { display_name: string | null; business_name: string | null }>();
    if (vendorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, business_name")
        .in("user_id", vendorIds);
      (profs || []).forEach((p: any) => vendorMap.set(p.user_id, p));
    }
    setOrders(
      ((orderRows || []) as any[]).map((o) => ({ ...o, vendor: vendorMap.get(o.vendor_id) || null }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isActive = (o: SponsorOrder) =>
    o.status === "active" && new Date(o.ends_at) > new Date();
  const isExpired = (o: SponsorOrder) =>
    o.status === "expired" || (o.status === "active" && new Date(o.ends_at) <= new Date());

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    active: orders.filter((o) => isActive(o)).length,
    expired: orders.filter((o) => isExpired(o)).length,
    revenue: orders.filter((o) => o.status !== "rejected" && o.status !== "cancelled").reduce((s, o) => s + Number(o.amount || 0), 0),
  }), [orders]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "pending" && o.status !== "pending") return false;
      if (filter === "active" && !isActive(o)) return false;
      if (filter === "expired" && !isExpired(o)) return false;
      if (!needle) return true;
      const hay = [
        o.vendor?.display_name, o.vendor?.business_name, o.vendor_services?.title,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, filter, q]);

  const syncServiceFlag = async (serviceId: string, sponsored: boolean, untilIso: string | null) => {
    await supabase.from("vendor_services").update({
      is_sponsored: sponsored,
      sponsored_until: sponsored ? untilIso : null,
      sponsored_started_at: sponsored ? new Date().toISOString() : null,
    }).eq("id", serviceId);
  };

  const notifyVendor = async (vendorId: string, title: string, message: string, type = "info") => {
    await supabase.from("notifications").insert({ user_id: vendorId, title, message, type });
  };

  const updateOrder = async (id: string, patch: { status?: string; ends_at?: string; days?: number }) => {
    const { error } = await supabase.from("sponsorship_orders").update(patch).eq("id", id);
    if (error) throw error;
  };

  const handleApprove = async (o: SponsorOrder) => {
    setBusyId(o.id);
    try {
      await updateOrder(o.id, { status: "active" });
      if (o.vendor_services) await syncServiceFlag(o.service_id, true, o.ends_at);
      await notifyVendor(o.vendor_id, "Sponsorship approved", `Your sponsorship for "${o.vendor_services?.title}" is now live.`, "success");
      toast.success("Sponsorship approved");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const handleReject = async (o: SponsorOrder) => {
    setBusyId(o.id);
    try {
      await updateOrder(o.id, { status: "rejected" });
      if (o.vendor_services?.is_sponsored) await syncServiceFlag(o.service_id, false, null);
      await notifyVendor(o.vendor_id, "Sponsorship rejected", `Your sponsorship request for "${o.vendor_services?.title}" was rejected.`, "warning");
      toast.success("Sponsorship rejected");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const handleToggleListing = async (o: SponsorOrder) => {
    if (!o.vendor_services) { toast.error("Service no longer exists"); return; }
    setBusyId(o.id);
    try {
      const next = !o.vendor_services.is_sponsored;
      await syncServiceFlag(o.service_id, next, next ? o.ends_at : null);
      toast.success(next ? "Listing activated" : "Listing deactivated");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const handleExtend = async () => {
    if (!extendOpen || extendDays <= 0) return;
    setBusyId(extendOpen.id);
    try {
      const base = new Date(extendOpen.ends_at).getTime();
      const newEnds = new Date(Math.max(base, Date.now()) + extendDays * 86400000).toISOString();
      await updateOrder(extendOpen.id, { ends_at: newEnds, days: extendOpen.days + extendDays, status: "active" });
      if (extendOpen.vendor_services) await syncServiceFlag(extendOpen.service_id, true, newEnds);
      await notifyVendor(extendOpen.vendor_id, "Sponsorship extended", `Your sponsorship for "${extendOpen.vendor_services?.title}" was extended by ${extendDays} days.`, "success");
      toast.success("Sponsorship extended");
      setExtendOpen(null);
      setExtendDays(7);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const statusBadge = (o: SponsorOrder) => {
    if (o.status === "pending") return <Badge variant="secondary">Pending</Badge>;
    if (o.status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (o.status === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
    if (isActive(o)) return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Active</Badge>;
    return <Badge variant="outline">Expired</Badge>;
  };

  return (
    <div className="space-y-6">
      <header>
        <Heading level={1} >Sponsored Services</Heading>
        <p className="text-fs-sm text-muted-foreground mt-1">
          Review provider sponsorship orders, toggle listings, and extend duration.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total orders", value: stats.total, icon: Sparkles },
          { label: "Pending", value: stats.pending, icon: Clock },
          { label: "Active", value: stats.active, icon: Play },
          { label: "Expired", value: stats.expired, icon: Pause },
          { label: "Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign },
        ].map((s) => (
          <AppCard key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-fs-xs text-muted-foreground">
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </div>
            <p className="text-fs-xl font-semibold mt-1">{s.value}</p>
          </AppCard>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by provider or service"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="No sponsorships" description="No orders match this filter." />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <AppCard key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-heading truncate">{o.vendor_services?.title || "Deleted service"}</p>
                    {statusBadge(o)}
                    {o.vendor_services?.is_sponsored && (
                      <Badge variant="outline" className="text-fs-xs">Listing on</Badge>
                    )}
                  </div>
                  <p className="text-fs-xs text-muted-foreground mt-1">
                    {o.vendor?.business_name || o.vendor?.display_name || "Provider"} ·{" "}
                    {format(new Date(o.starts_at), "MMM d, yyyy")} → {format(new Date(o.ends_at), "MMM d, yyyy")} · {o.days} days
                  </p>
                  <p className="text-fs-xs text-muted-foreground">
                    Ordered {format(new Date(o.created_at), "MMM d, yyyy 'at' HH:mm")} · ${Number(o.amount).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {o.status === "pending" && (
                    <>
                      <Button size="sm" disabled={busyId === o.id} onClick={() => handleApprove(o)}>
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => handleReject(o)}>
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {o.vendor_services && o.status !== "pending" && o.status !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => handleToggleListing(o)}>
                      {o.vendor_services.is_sponsored
                        ? <><Pause className="w-4 h-4 mr-1" /> Deactivate</>
                        : <><Play className="w-4 h-4 mr-1" /> Activate</>}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setExtendOpen(o); setExtendDays(7); }}>
                    <CalendarPlus className="w-4 h-4 mr-1" /> Extend
                  </Button>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      <Dialog open={!!extendOpen} onOpenChange={(o) => !o && setExtendOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend sponsorship</DialogTitle>
            <DialogDescription>
              Add additional days to the sponsorship window. The service listing's expiry will move with it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-fs-sm font-medium">Additional days</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={extendDays}
              onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value) || 0))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(null)}>Cancel</Button>
            <Button onClick={handleExtend} disabled={!extendOpen || busyId === extendOpen?.id}>
              Extend by {extendDays} days
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}