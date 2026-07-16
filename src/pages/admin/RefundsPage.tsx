import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ADMIN_STATUS_TONES, ADMIN_STAT_ACCENTS } from "@/lib/roleTokens";
import { Search, Eye, CheckCircle, XCircle, Clock, RotateCcw } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface RefundRow {
  id: string;
  booking_id: string;
  customer_id: string;
  amount: number;
  reason: string;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending:  { color: ADMIN_STATUS_TONES.warning, icon: Clock },
  approved: { color: ADMIN_STATUS_TONES.settled, icon: CheckCircle },
  denied:   { color: ADMIN_STATUS_TONES.danger,  icon: XCircle },
};

export default function RefundsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [open, setOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const items = (data as RefundRow[]) || [];
    setRows(items);

    const ids = [...new Set(items.map((r) => r.customer_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.display_name || "Unknown"; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (profiles[r.customer_id] || "").toLowerCase();
        if (!r.reason.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search, profiles]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const stats = useMemo(() => ({
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    denied: rows.filter((r) => r.status === "denied").length,
    total_amount: rows.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0),
  }), [rows]);

  const openDetail = (r: RefundRow) => {
    setSelected(r);
    setAdminNotes(r.admin_notes || "");
    setNewStatus(r.status);
    setOpen(true);
  };

  const save = async () => {
    if (!selected || !user) return;
    setSaving(true);

    // Approval path: atomically credit wallet + notify customer via RPC
    if (newStatus === "approved" && selected.status !== "approved") {
      const { error } = await supabase.rpc("approve_refund", {
        _refund_id: selected.id,
        _admin_notes: adminNotes.trim() || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Refund approved — $${Number(selected.amount).toFixed(2)} credited to customer wallet`);
      setOpen(false);
      load();
      return;
    }

    // Denial / notes update path
    const updates: any = {
      admin_notes: adminNotes.trim() || null,
      status: newStatus,
    };
    if (newStatus !== "pending" && selected.status !== newStatus) {
      updates.reviewed_by = user.id;
      updates.reviewed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("refund_requests").update(updates).eq("id", selected.id);

    // For denial, also notify the customer (best-effort)
    if (!error && newStatus === "denied" && selected.status !== "denied") {
      await supabase.from("notifications").insert({
        user_id: selected.customer_id,
        title: "Refund request denied",
        message: adminNotes.trim()
          ? `Your refund request was denied: ${adminNotes.trim()}`
          : "Your refund request was denied. Contact support if you have questions.",
        type: "warning",
        metadata: { refund_id: selected.id, booking_id: selected.booking_id },
      });
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Refund updated");
    setOpen(false);
    load();
  };

  if (loading) {
    return (
      <AdminPage title="Refund Requests">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Refund Requests" subtitle="Review and approve customer refund requests.">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pending",        value: stats.pending,                       icon: Clock,       ...ADMIN_STAT_ACCENTS.warning },
            { label: "Approved",       value: stats.approved,                      icon: CheckCircle, ...ADMIN_STAT_ACCENTS.primary },
            { label: "Denied",         value: stats.denied,                        icon: XCircle,     ...ADMIN_STAT_ACCENTS.danger },
            { label: "Refunded Total", value: `$${stats.total_amount.toFixed(2)}`, icon: RotateCcw,   ...ADMIN_STAT_ACCENTS.info },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal">
              <div className="flex items-center justify-between mb-3">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.accent)} />
                </div>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by reason or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <RotateCcw className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm">
              {rows.length === 0 ? "No refund requests yet" : "No requests match your filters"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Customer</th>
                    <th className="text-left py-3 px-5 font-medium">Reason</th>
                    <th className="text-right py-3 px-5 font-medium">Amount</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Date</th>
                    <th className="text-right py-3 px-5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => {
                    const sc = statusConfig[r.status] || statusConfig.pending;
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-5 text-heading font-medium">{profiles[r.customer_id] || "Unknown"}</td>
                        <td className="py-3 px-5 text-body truncate max-w-[280px]">{r.reason}</td>
                        <td className="py-3 px-5 text-right font-medium text-heading tabular-nums">${Number(r.amount).toFixed(2)}</td>
                        <td className="py-3 px-5">
                          <Badge variant="secondary" className={cn("text-[10px] capitalize", sc.color)}>{r.status}</Badge>
                        </td>
                        <td className="py-3 px-5 text-fs-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-5 text-right">
                          <Button variant="ghost" size="sm" className="gap-1 text-fs-xs" onClick={() => openDetail(r)}>
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setPage}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund Request</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Customer</Label>
                  <p className="text-fs-sm font-medium text-heading">{profiles[selected.customer_id] || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Amount</Label>
                  <p className="text-fs-sm font-semibold text-heading tabular-nums">${Number(selected.amount).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Booking ID</Label>
                  <p className="text-fs-xs font-mono text-muted-foreground">{selected.booking_id.slice(0, 8)}...</p>
                </div>
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Submitted</Label>
                  <p className="text-fs-sm text-body">{new Date(selected.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-fs-xs text-muted-foreground">Reason</Label>
                <div className="bg-muted/30 rounded-lg p-3 text-fs-sm text-body">{selected.reason}</div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="denied">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Reason for approval/denial (visible to customer)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[90px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Update Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
