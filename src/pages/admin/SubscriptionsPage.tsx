import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppTable, type AppTableColumn } from "@/components/ui/app/AppTable";
import { createNotification } from "@/lib/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface Plan {
  id: string;
  name: string;
  interval: string;
  price: number;
  currency: string;
  is_active: boolean;
}

interface Row {
  id: string;
  provider_id: string;
  status: string;
  current_period_end: string | null;
  started_at: string | null;
  cancel_at_period_end: boolean;
  plan?: { name: string; interval: string; price: number } | null;
  provider?: { display_name: string | null } | null;
}

const statusVariant = (s: string) =>
  s === "active" ? "default" : s === "expired" ? "destructive" : "secondary";

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planRow, setPlanRow] = useState<Row | null>(null);
  const [newPlanId, setNewPlanId] = useState<string>("");
  const [historyRow, setHistoryRow] = useState<Row | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("provider_subscriptions")
      .select("*, plan:subscription_plans(name, interval, price)")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Row[];
    const ids = Array.from(new Set(list.map((r) => r.provider_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
      list.forEach((r) => (r.provider = { display_name: map.get(r.provider_id) ?? null }));
    }
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setPlans((data ?? []) as Plan[]);
    })();
  }, []);

  const intervalDays = (i?: string) =>
    i === "yearly" ? 365 : i === "quarterly" ? 90 : 30;

  const runAction = async (
    row: Row,
    action: "activate" | "suspend" | "cancel" | "renew",
  ) => {
    const payload: Record<string, unknown> = {};
    let notifTitle = "";
    let notifMsg = "";
    let notifType: "subscription_renewed" | "subscription_expired" = "subscription_renewed";

    if (action === "activate") {
      payload.status = "active";
      payload.cancel_at_period_end = false;
      const end = row.current_period_end ? new Date(row.current_period_end) : new Date();
      if (end < new Date()) end.setDate(new Date().getDate() + intervalDays(row.plan?.interval));
      payload.current_period_end = end.toISOString();
      notifTitle = "Subscription activated";
      notifMsg = "An admin activated your subscription.";
    } else if (action === "suspend") {
      payload.status = "pending";
      notifTitle = "Subscription suspended";
      notifMsg = "An admin suspended your subscription. Contact support to restore access.";
      notifType = "subscription_expired";
    } else if (action === "cancel") {
      payload.status = "cancelled";
      payload.cancel_at_period_end = true;
      notifTitle = "Subscription cancelled";
      notifMsg = "Your subscription has been cancelled by an admin.";
      notifType = "subscription_expired";
    } else if (action === "renew") {
      payload.status = "active";
      payload.cancel_at_period_end = false;
      const base = row.current_period_end && new Date(row.current_period_end) > new Date()
        ? new Date(row.current_period_end)
        : new Date();
      base.setDate(base.getDate() + intervalDays(row.plan?.interval));
      payload.current_period_end = base.toISOString();
      payload.last_renewed_at = new Date().toISOString();
      notifTitle = "Subscription renewed";
      notifMsg = `Your subscription was renewed until ${format(base, "MMM d, yyyy")}.`;
    }

    const { error } = await supabase
      .from("provider_subscriptions")
      .update(payload as any)
      .eq("id", row.id);
    if (error) return toast.error(error.message);

    await createNotification({
      userId: row.provider_id,
      type: notifType,
      title: notifTitle,
      message: notifMsg,
      metadata: { subscription_id: row.id, action },
    });
    toast.success(notifTitle);
    load();
  };

  const changePlan = async () => {
    if (!planRow || !newPlanId) return;
    const plan = plans.find((p) => p.id === newPlanId);
    const end = new Date();
    end.setDate(end.getDate() + intervalDays(plan?.interval));
    const { error } = await supabase
      .from("provider_subscriptions")
      .update({
        plan_id: newPlanId,
        status: "active",
        current_period_end: end.toISOString(),
        last_renewed_at: new Date().toISOString(),
        cancel_at_period_end: false,
      })
      .eq("id", planRow.id);
    if (error) return toast.error(error.message);
    await createNotification({
      userId: planRow.provider_id,
      type: "subscription_renewed",
      title: "Plan changed",
      message: `Your subscription plan was changed to ${plan?.name ?? "a new plan"}.`,
      metadata: { subscription_id: planRow.id, plan_id: newPlanId },
    });
    toast.success("Plan changed");
    setPlanRow(null);
    setNewPlanId("");
    load();
  };

  const openHistory = async (row: Row) => {
    setHistoryRow(row);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("payment_transactions")
      .select("id, amount, payment_method, payment_type, status, created_at, metadata")
      .or(`user_id.eq.${row.provider_id},vendor_id.eq.${row.provider_id}`)
      .order("created_at", { ascending: false })
      .limit(50);
    const subs = (data ?? []).filter(
      (p: any) =>
        p.payment_type?.toLowerCase().includes("subscription") ||
        p.metadata?.subscription_id === row.id ||
        p.metadata?.kind === "subscription",
    );
    setHistory(subs.length ? subs : data ?? []);
    setHistoryLoading(false);
  };

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (r.provider?.display_name ?? "").toLowerCase().includes(q) ||
        (r.plan?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: AppTableColumn<Row>[] = [
    {
      key: "provider",
      header: "Provider",
      cell: (r) => (
        <span className="font-medium text-heading">
          {r.provider?.display_name || r.provider_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) =>
        r.plan ? `${r.plan.name} · ${r.plan.interval}` : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>,
    },
    {
      key: "current_period_end",
      header: "Period ends",
      cell: (r) =>
        r.current_period_end ? format(new Date(r.current_period_end), "MMM d, yyyy") : "—",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="px-2">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Manage</DropdownMenuLabel>
            {r.status !== "active" && (
              <DropdownMenuItem onClick={() => runAction(r, "activate")}>Activate</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => runAction(r, "renew")}>Renew period</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setPlanRow(r);
                setNewPlanId(plans.find((p) => p.name === r.plan?.name)?.id ?? "");
              }}
            >
              Change plan
            </DropdownMenuItem>
            {r.status === "active" && (
              <DropdownMenuItem onClick={() => runAction(r, "suspend")}>Suspend</DropdownMenuItem>
            )}
            {r.status !== "cancelled" && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => runAction(r, "cancel")}
              >
                Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openHistory(r)}>Payment history</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Heading level={1} >Subscriptions</Heading>
        <p className="text-fs-sm text-muted-foreground">Manually activate or deactivate provider subscriptions.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search provider or plan"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AppTable<Row>
        data={filtered}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyState={<p className="text-fs-sm text-muted-foreground py-8 text-center">No subscriptions yet.</p>}
      />

      <Dialog open={!!planRow} onOpenChange={(o) => !o && setPlanRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change subscription plan</DialogTitle>
            <DialogDescription>
              Move {planRow?.provider?.display_name ?? "provider"} to a different plan. The new period
              starts today.
            </DialogDescription>
          </DialogHeader>
          <Select value={newPlanId} onValueChange={setNewPlanId}>
            <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.interval} · {p.currency} {Number(p.price).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanRow(null)}>Cancel</Button>
            <Button onClick={changePlan} disabled={!newPlanId}>Change plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyRow} onOpenChange={(o) => !o && setHistoryRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment history</DialogTitle>
            <DialogDescription>
              {historyRow?.provider?.display_name ?? "Provider"} — recent transactions.
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : history.length === 0 ? (
            <p className="text-fs-sm text-muted-foreground py-6 text-center">No payments found.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y">
              {history.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-fs-sm">
                  <div>
                    <p className="font-medium text-heading">${Number(p.amount).toFixed(2)} · {p.payment_method}</p>
                    <p className="text-fs-xs text-muted-foreground">
                      {format(new Date(p.created_at), "MMM d, yyyy HH:mm")} · {p.payment_type}
                    </p>
                  </div>
                  <Badge variant={p.status === "completed" || p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}