import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/app";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Flag, Eye, EyeOff, CheckCircle, XCircle, MessageSquare, Star, Briefcase,
  User, Image as ImageIcon, ShieldCheck, ExternalLink, Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportRow {
  id: string;
  reporter_id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const ENTITY_META: Record<string, { label: string; icon: any; href?: (id: string) => string }> = {
  review:       { label: "Review",       icon: Star },
  message:      { label: "Message",      icon: MessageSquare },
  task:         { label: "Job post",     icon: Briefcase,    href: () => "/admin/jobs" },
  profile:      { label: "Profile",      icon: User,         href: (id) => `/provider/${id}` },
  service:      { label: "Service",      icon: Briefcase },
  portfolio:    { label: "Portfolio",    icon: ImageIcon },
  verification: { label: "Document",     icon: ShieldCheck,  href: () => "/admin/verifications" },
};

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    open: "bg-amber-50 text-amber-700",
    reviewing: "bg-blue-50 text-blue-700",
    actioned: "bg-emerald-50 text-emerald-700",
    dismissed: "bg-muted text-muted-foreground",
  };
  return <Badge className={tone[status] || tone.open}>{status}</Badge>;
}

function ReportsTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ReportRow | null>(null);
  const [notes, setNotes] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const resolve = async (id: string, status: "reviewing" | "actioned" | "dismissed") => {
    const { error } = await supabase
      .from("content_reports")
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`);
    setActive(null); setNotes("");
    fetchRows();
  };

  if (loading) return <LoadingState title="Loading reports" />;
  if (!rows.length) {
    return <p className="text-fs-sm text-muted-foreground p-6">No reports yet.</p>;
  }

  return (
    <>
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <table className="w-full text-fs-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reported</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = ENTITY_META[r.entity_type] || ENTITY_META.profile;
              const Icon = meta.icon;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />{meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.reason}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => { setActive(r); setNotes(r.admin_notes || ""); }}>
                      Review
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" /> Review report
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-fs-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <strong>{ENTITY_META[active.entity_type]?.label || active.entity_type}</strong>
              </div>
              <div><span className="text-muted-foreground">Reason:</span> {active.reason}</div>
              {active.details && (
                <div className="bg-muted/40 rounded-sm p-2 whitespace-pre-wrap">{active.details}</div>
              )}
              <div className="text-muted-foreground">
                Entity ID: <code className="text-fs-xs">{active.entity_id}</code>
              </div>
              {ENTITY_META[active.entity_type]?.href && (
                <Link
                  to={ENTITY_META[active.entity_type]!.href!(active.entity_id)}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  target="_blank"
                >
                  Open target <ExternalLink className="w-3 h-3" />
                </Link>
              )}
              <div>
                <label className="text-fs-xs text-muted-foreground">Admin notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => active && resolve(active.id, "reviewing")}>
              <Eye className="w-4 h-4 mr-1" /> Reviewing
            </Button>
            <Button variant="outline" onClick={() => active && resolve(active.id, "dismissed")}>
              <XCircle className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button onClick={() => active && resolve(active.id, "actioned")}>
              <CheckCircle className="w-4 h-4 mr-1" /> Actioned
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Moderatable = {
  id: string;
  primary: string;
  secondary?: string;
  created_at: string;
  is_hidden: boolean;
};

function ReviewRetentionCard({ onPurged }: { onPurged: () => void }) {
  const [days, setDays] = useState<string>("90");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "review_retention_days")
        .maybeSingle();
      if (data?.value) setDays(String(data.value));
      setLoading(false);
    })();
  }, []);

  const saveDays = async () => {
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1 || n > 3650) {
      toast.error("Retention must be between 1 and 3650 days");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("platform_settings")
      .upsert({ key: "review_retention_days", value: String(n), is_secret: false }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Retention updated");
  };

  const runPurge = async () => {
    if (!confirm(`Permanently delete every hidden review older than ${days} days? This cannot be undone.`)) return;
    setPurging(true);
    const { data, error } = await (supabase as any).rpc("purge_expired_hidden_reviews");
    setPurging(false);
    if (error) return toast.error(error.message);
    toast.success(`Purged ${data?.deleted ?? 0} review(s)`);
    onPurged();
  };

  return (
    <div className="border border-border rounded-sm p-3 mb-3 bg-muted/30">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-fs-xs">Review retention (days)</Label>
          <Input
            type="number"
            min={1}
            max={3650}
            value={days}
            disabled={loading}
            onChange={(e) => setDays(e.target.value)}
            className="h-9 w-32"
          />
        </div>
        <Button size="sm" variant="outline" onClick={saveDays} disabled={saving || loading}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" variant="destructive" onClick={runPurge} disabled={purging || loading} className="ml-auto">
          {purging ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
          Purge hidden reviews past retention
        </Button>
      </div>
      <p className="text-fs-xs text-muted-foreground mt-2">
        Hidden reviews older than this window can be permanently removed. All deletions are recorded in the admin audit log.
      </p>
    </div>
  );
}

function HardDeleteReviewDialog({
  reviewId,
  preview,
  open,
  onOpenChange,
  onDeleted,
}: {
  reviewId: string | null;
  preview: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setReason(""); setConfirmText(""); }
  }, [open]);

  const canSubmit = reason.trim().length >= 5 && confirmText.trim().toUpperCase() === "DELETE";

  const submit = async () => {
    if (!reviewId || !canSubmit) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_hard_delete_review", {
      _review_id: reviewId,
      _reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Review permanently deleted");
    onOpenChange(false);
    onDeleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Permanently delete review
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border border-border rounded-sm p-2 bg-muted/30">
            <p className="text-fs-xs text-muted-foreground">Review preview</p>
            <p className="text-fs-sm clamp-2">{preview || "(no comment)"}</p>
          </div>
          <p className="text-fs-xs text-destructive">
            This action is irreversible. The review is removed for everyone. The action is logged with your admin account.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="hd-reason">Reason (required, min 5 chars)</Label>
            <Textarea
              id="hd-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Contains PII and repeated complaints from reviewer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hd-confirm">Type DELETE to confirm</Label>
            <Input
              id="hd-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModerationListTab({
  table,
  selectQuery,
  map,
  emptyLabel,
}: {
  table: "reviews" | "messages" | "profiles";
  selectQuery: string;
  map: (r: any) => Moderatable;
  emptyLabel: string;
}) {
  const [rows, setRows] = useState<Moderatable[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRow, setDeleteRow] = useState<Moderatable | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from(table)
      .select(selectQuery)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setRows(((data as any[]) || []).map(map));
    setLoading(false);
  }, [table, selectQuery, map]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleHide = async (row: Moderatable) => {
    if (table === "profiles") {
      const newStatus = row.is_hidden ? "active" : "suspended";
      const { error } = await (supabase as any).from("profiles").update({ status: newStatus }).eq("user_id", row.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from(table).update({ is_hidden: !row.is_hidden }).eq("id", row.id);
      if (error) return toast.error(error.message);
    }
    toast.success(row.is_hidden ? "Restored" : "Hidden");
    fetchRows();
  };

  const isReviews = table === "reviews";

  return (
    <>
      {isReviews && <ReviewRetentionCard onPurged={fetchRows} />}
      {loading ? (
        <LoadingState title={`Loading ${table}`} />
      ) : !rows.length ? (
        <p className="text-fs-sm text-muted-foreground p-6">{emptyLabel}</p>
      ) : (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full text-fs-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border first:border-t-0">
                  <td className="px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`clamp-2 ${r.is_hidden ? "line-through text-muted-foreground" : ""}`}>
                          {r.primary}
                        </p>
                        {r.secondary && (
                          <p className="text-fs-xs text-muted-foreground mt-0.5">{r.secondary}</p>
                        )}
                        <p className="text-fs-xs text-muted-foreground mt-0.5">
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => toggleHide(r)}>
                          {r.is_hidden ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                          {r.is_hidden ? "Restore" : "Hide"}
                        </Button>
                        {isReviews && (
                          <Button size="sm" variant="destructive" onClick={() => setDeleteRow(r)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isReviews && (
        <HardDeleteReviewDialog
          reviewId={deleteRow?.id ?? null}
          preview={deleteRow?.primary ?? ""}
          open={!!deleteRow}
          onOpenChange={(o) => !o && setDeleteRow(null)}
          onDeleted={fetchRows}
        />
      )}
    </>
  );
}


export default function ModerationCenterPage() {
  return (
    <AdminPage title="Moderation Center" subtitle="Review reports and moderate user-generated content.">
      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="reports"><Flag className="w-4 h-4 mr-1" /> Reports</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="w-4 h-4 mr-1" /> Reviews</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="w-4 h-4 mr-1" /> Messages</TabsTrigger>
          <TabsTrigger value="profiles"><User className="w-4 h-4 mr-1" /> Profiles</TabsTrigger>
          <TabsTrigger value="other"><ShieldCheck className="w-4 h-4 mr-1" /> Jobs &amp; Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="reports"><ReportsTab /></TabsContent>

        <TabsContent value="reviews">
          <ModerationListTab
            table="reviews"
            selectQuery="id, comment, rating, is_hidden, created_at"
            map={(r) => ({
              id: r.id,
              primary: r.comment || "(no comment)",
              secondary: `${r.rating}★`,
              created_at: r.created_at,
              is_hidden: !!r.is_hidden,
            })}
            emptyLabel="No reviews yet."
          />
        </TabsContent>

        <TabsContent value="messages">
          <ModerationListTab
            table="messages"
            selectQuery="id, content, is_hidden, created_at"
            map={(r) => ({
              id: r.id,
              primary: r.content || "(empty)",
              created_at: r.created_at,
              is_hidden: !!r.is_hidden,
            })}
            emptyLabel="No messages yet."
          />
        </TabsContent>

        <TabsContent value="profiles">
          <ModerationListTab
            table="profiles"
            selectQuery="user_id, display_name, bio, status, created_at"
            map={(r) => ({
              id: r.user_id,
              primary: r.display_name || "Unnamed user",
              secondary: r.bio || undefined,
              created_at: r.created_at,
              is_hidden: r.status === "suspended",
            })}
            emptyLabel="No profiles yet."
          />
        </TabsContent>

        <TabsContent value="other">
          <div className="grid sm:grid-cols-2 gap-3">
            <Link to="/admin/jobs" className="bg-card border border-border rounded-sm p-4 hover:bg-muted/30">
              <p className="font-medium flex items-center gap-2"><Briefcase className="w-4 h-4" /> Job posts</p>
              <p className="text-fs-xs text-muted-foreground mt-1">Suspend, feature or annotate job listings.</p>
            </Link>
            <Link to="/admin/verifications" className="bg-card border border-border rounded-sm p-4 hover:bg-muted/30">
              <p className="font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Uploaded documents</p>
              <p className="text-fs-xs text-muted-foreground mt-1">Approve, reject or request more info on verification docs.</p>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}