import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Wallet } from "lucide-react";
import { WithdrawalRow } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: WithdrawalRow | null;
  profiles: Record<string, string>;
  onSaved: () => void;
}

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

export default function ReviewDialog({ open, onOpenChange, selected, profiles, onSaved }: Props) {
  const { user } = useAuth();
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (selected) {
      setAdminNotes(selected.admin_notes || "");
      setNewStatus(selected.status);
      setWalletBalance(null);
      // Fetch live wallet balance for context
      supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", selected.vendor_id)
        .maybeSingle()
        .then(({ data }) => setWalletBalance(data ? Number(data.balance) : 0));
    }
  }, [selected]);

  const providerName = selected ? (profiles[selected.vendor_id] || "Provider") : "";
  const requested = selected ? Number(selected.amount) : 0;
  const shortBy = walletBalance !== null ? Math.max(0, requested - walletBalance) : 0;
  const insufficient = walletBalance !== null && walletBalance < requested;

  const save = async () => {
    if (!selected || !user) return;
    setSaving(true);

    // Marking as paid → use atomic RPC that debits wallet + notifies provider
    if (newStatus === "paid" && selected.status !== "paid") {
      const { data, error } = await supabase.rpc("mark_withdrawal_paid", {
        _withdrawal_id: selected.id,
        _admin_notes: adminNotes.trim() || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      const result = data as { success?: boolean; auto_rejected?: boolean; reason?: string; wallet_balance?: number; requested?: number } | null;
      if (result?.auto_rejected) {
        const bal = Number(result.wallet_balance ?? 0);
        const need = Number(result.requested ?? requested);
        const gap = Math.max(0, need - bal);
        toast.warning(`${providerName} only has ${fmt(bal)} — short by ${fmt(gap)}`, {
          description: "Withdrawal auto-rejected. Top up the provider's wallet to retry.",
          duration: 6000,
        });
      } else {
        toast.success("Withdrawal paid — provider notified");
      }
      onOpenChange(false);
      onSaved();
      return;
    }

    const updates: any = {
      admin_notes: adminNotes.trim() || null,
      status: newStatus,
    };
    if (newStatus !== "pending" && selected.status !== newStatus) {
      updates.reviewed_by = user.id;
      updates.reviewed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("withdrawals").update(updates).eq("id", selected.id);

    // Best-effort notification on denial
    if (!error && newStatus === "denied" && selected.status !== "denied") {
      await supabase.from("notifications").insert({
        user_id: selected.vendor_id,
        title: "Withdrawal denied",
        message: `Your withdrawal request of ${fmt(Number(selected.amount))} was denied.${adminNotes.trim() ? ` Note: ${adminNotes.trim()}` : ""}`,
        type: "warning",
        metadata: { withdrawal_id: selected.id, amount: selected.amount },
      });
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal updated");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Withdrawal Request</DialogTitle>
        </DialogHeader>
        {selected && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-fs-xs text-muted-foreground">Provider</Label>
                <p className="text-fs-sm font-medium text-heading">{profiles[selected.vendor_id] || "Unknown"}</p>
              </div>
              <div>
                <Label className="text-fs-xs text-muted-foreground">Amount</Label>
                <p className="text-fs-sm font-semibold text-heading tabular-nums">{fmt(requested)}</p>
              </div>
              <div>
                <Label className="text-fs-xs text-muted-foreground">Method</Label>
                <p className="text-fs-sm text-body capitalize">{selected.payment_method.replace("_", " ")}</p>
              </div>
              <div>
                <Label className="text-fs-xs text-muted-foreground">Requested</Label>
                <p className="text-fs-sm text-body">{new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Wallet balance context */}
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                insufficient
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-muted/30"
              }`}
            >
              {insufficient ? (
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              ) : (
                <Wallet className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-fs-xs text-muted-foreground">Provider wallet balance</p>
                <p className={`text-fs-sm font-semibold tabular-nums ${insufficient ? "text-destructive" : "text-heading"}`}>
                  {walletBalance === null ? "Loading..." : fmt(walletBalance)}
                </p>
                {insufficient && (
                  <p className="text-fs-xs text-destructive mt-1">
                    Short by <span className="font-semibold tabular-nums">{fmt(shortBy)}</span> — marking as paid will auto-reject.
                  </p>
                )}
              </div>
              {insufficient && (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link
                    to={`/admin/users?focus=${selected.vendor_id}`}
                    onClick={() => onOpenChange(false)}
                  >
                    Top up wallet
                  </Link>
                </Button>
              )}
            </div>

            {selected.payment_details && Object.keys(selected.payment_details).length > 0 && (
              <div className="space-y-2">
                <Label className="text-fs-xs text-muted-foreground">Payment Details</Label>
                <pre className="bg-muted/30 rounded-lg p-3 text-fs-xs text-body overflow-x-auto">
                  {JSON.stringify(selected.payment_details, null, 2)}
                </pre>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="paid">Mark as Paid</SelectItem>
                  <SelectItem value="denied">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                placeholder="Internal notes or transaction reference..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="min-h-[90px]"
              />
            </div>

            {selected.paid_at && (
              <p className="text-fs-xs text-muted-foreground">Paid on {new Date(selected.paid_at).toLocaleString()}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Update Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
