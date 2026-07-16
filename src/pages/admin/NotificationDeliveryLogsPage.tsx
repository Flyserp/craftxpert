import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type LogRow = {
  id: string;
  recipient_user_id: string | null;
  channel: string;
  event_type: string | null;
  title: string | null;
  body: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  provider_response: unknown;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  failed: "destructive",
  skipped: "secondary",
};

export default function NotificationDeliveryLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("notification_delivery_logs")
      .select("id, recipient_user_id, channel, event_type, title, body, status, error, provider_response, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (channelFilter !== "all") query = query.eq("channel", channelFilter);

    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error("Could not load notification logs");
    } else {
      setRows((data ?? []) as LogRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, channelFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.title, r.body, r.error, r.event_type, r.recipient_user_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Notification Delivery Logs</h1>
        <p className="text-description-sm">Recent notification attempts with error details for troubleshooting.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent deliveries</CardTitle>
            <CardDescription>Showing the last 200 attempts across all channels.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search title, body, error, user id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="in_app">In-app</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No delivery logs match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.channel}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[r.status] ?? "outline"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.title ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.recipient_user_id ? r.recipient_user_id.slice(0, 8) + "…" : "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-destructive">
                      {r.error ? (
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {r.error}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery details</DialogTitle>
            <DialogDescription>
              {selected && new Date(selected.created_at).toLocaleString()} · {selected?.channel} · {selected?.status}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Field label="Recipient" value={selected.recipient_user_id ?? "—"} mono />
              <Field label="Event type" value={selected.event_type ?? "—"} />
              <Field label="Title" value={selected.title ?? "—"} />
              <Field label="Body" value={selected.body ?? "—"} />
              <Field label="Error" value={selected.error ?? "—"} />
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Provider response</div>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(selected.provider_response ?? null, null, 2)}
                </pre>
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "break-words"}>{value}</div>
    </div>
  );
}
