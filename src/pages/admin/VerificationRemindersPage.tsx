import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCcw, AlertCircle, Bell, Mail, Building2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

type ReminderRow = {
  id: string;
  window_key: string;
  window_days: number;
  window_label: string | null;
  kind: "vendor" | "employer";
  target_id: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  expires_at: string | null;
  notification_id: string | null;
  in_app_status: "pending" | "sent" | "failed" | "skipped";
  in_app_error: string | null;
  email_status: "pending" | "sent" | "failed" | "skipped";
  email_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  failed: "destructive",
  skipped: "secondary",
  pending: "outline",
};

const KIND_META: Record<ReminderRow["kind"], { label: string; icon: typeof Building2 }> = {
  vendor: { label: "Vendor", icon: UserIcon },
  employer: { label: "Employer", icon: Building2 },
};

export default function VerificationRemindersPage() {
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowFilter, setWindowFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // sent/failed/skipped filters both channels
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReminderRow | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("verification_reminder_log")
      .select(
        "id, window_key, window_days, window_label, kind, target_id, recipient_user_id, recipient_email, recipient_name, expires_at, notification_id, in_app_status, in_app_error, email_status, email_error, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (windowFilter !== "all") query = query.eq("window_key", windowFilter);
    if (kindFilter !== "all") query = query.eq("kind", kindFilter);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error("Could not load verification reminders");
    } else {
      setRows((data ?? []) as ReminderRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFilter, kindFilter]);

  const windowOptions = useMemo(() => {
    const set = new Map<string, { key: string; label: string; days: number }>();
    for (const r of rows) {
      if (!set.has(r.window_key)) {
        set.set(r.window_key, {
          key: r.window_key,
          label: r.window_label ?? `${r.window_days} day${r.window_days === 1 ? "" : "s"}`,
          days: r.window_days,
        });
      }
    }
    return Array.from(set.values()).sort((a, b) => b.days - a.days);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        // Match if either channel matches the filter
        if (r.in_app_status !== statusFilter && r.email_status !== statusFilter) return false;
      }
      if (!q) return true;
      const haystack = [
        r.recipient_email,
        r.recipient_name,
        r.recipient_user_id,
        r.target_id,
        r.window_label,
        r.window_key,
        r.in_app_error,
        r.email_error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, in_app_sent: 0, in_app_failed: 0, email_sent: 0, email_failed: 0 };
    for (const r of filtered) {
      if (r.in_app_status === "sent") s.in_app_sent += 1;
      if (r.in_app_status === "failed") s.in_app_failed += 1;
      if (r.email_status === "sent") s.email_sent += 1;
      if (r.email_status === "failed") s.email_failed += 1;
    }
    return s;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Verification reminder audit</h1>
        <p className="text-description-sm">
          Every expiry reminder dispatched by the verification sweep job, with in-app and email
          delivery outcomes.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total reminders" value={stats.total} />
        <StatCard label="In-app sent" value={stats.in_app_sent} tone="success" />
        <StatCard label="In-app failed" value={stats.in_app_failed} tone={stats.in_app_failed ? "danger" : undefined} />
        <StatCard label="Email sent" value={stats.email_sent} tone="success" />
        <StatCard label="Email failed" value={stats.email_failed} tone={stats.email_failed ? "danger" : undefined} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent reminders</CardTitle>
            <CardDescription>Showing the last 500 dispatched reminders.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search recipient, email, target id, error…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={windowFilter} onValueChange={setWindowFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Window" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All windows</SelectItem>
                {windowOptions.map((w) => (
                  <SelectItem key={w.key} value={w.key}>
                    {w.label} ({w.days}d)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Recipient" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recipients</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
                <SelectItem value="employer">Employers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">When</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>In-app</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No reminders match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => {
                  const KindIcon = KIND_META[r.kind].icon;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.window_label ?? `${r.window_days}d`}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <div className="truncate font-medium">{r.recipient_name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.recipient_email ?? (r.recipient_user_id ? r.recipient_user_id.slice(0, 8) + "…" : "—")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <KindIcon className="h-3.5 w-3.5" /> {KIND_META[r.kind].label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill icon={Bell} status={r.in_app_status} error={r.in_app_error} />
                      </TableCell>
                      <TableCell>
                        <StatusPill icon={Mail} status={r.email_status} error={r.email_error} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.expires_at
                          ? new Date(r.expires_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reminder details</DialogTitle>
            <DialogDescription>
              {selected && new Date(selected.created_at).toLocaleString()} ·{" "}
              {selected?.window_label ?? `${selected?.window_days}d`} · {selected && KIND_META[selected.kind].label}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Field label="Window" value={`${selected.window_key} (${selected.window_days}d)`} />
              <Field label="Recipient" value={selected.recipient_name ?? "—"} />
              <Field label="Recipient email" value={selected.recipient_email ?? "—"} />
              <Field label="Recipient user id" value={selected.recipient_user_id ?? "—"} mono />
              <Field label="Target" value={selected.target_id} mono />
              <Field
                label="Expires at"
                value={selected.expires_at ? new Date(selected.expires_at).toLocaleString() : "—"}
              />
              <Field label="Notification id" value={selected.notification_id ?? "—"} mono />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">In-app</div>
                  <Badge variant={STATUS_VARIANT[selected.in_app_status]}>{selected.in_app_status}</Badge>
                  {selected.in_app_error && (
                    <div className="text-xs text-destructive mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5" /> {selected.in_app_error}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Email</div>
                  <Badge variant={STATUS_VARIANT[selected.email_status]}>{selected.email_status}</Badge>
                  {selected.email_error && (
                    <div className="text-xs text-destructive mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5" /> {selected.email_error}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Metadata</div>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-40">
                  {JSON.stringify(selected.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  icon: Icon,
  status,
  error,
}: {
  icon: typeof Bell;
  status: ReminderRow["in_app_status"];
  error: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="capitalize">
        {status}
      </Badge>
      {error && <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label={error} />}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "break-words"}>{value}</div>
    </div>
  );
}
