import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface LogEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORIES: Record<string, string[]> = {
  All: [],
  Login: ["auth."],
  "Password & Profile": ["user.", "profile."],
  Jobs: ["job."],
  Bookings: ["booking."],
  Payments: ["payment.", "withdrawal.", "refund."],
  Verifications: ["verification."],
};

function labelFor(action: string) {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.startsWith("payment.") || action.startsWith("booking.") || action.includes("approved") || action.includes("paid")) return "default";
  if (action.includes("rejected") || action.includes("denied") || action.includes("expired")) return "destructive";
  if (action.startsWith("auth.")) return "secondary";
  return "outline";
}

export default function ActivityPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id, action, entity_type, entity_id, details, created_at")
        .or(`actor_id.eq.${user.id},target_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (!error && data) setLogs(data as LogEntry[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const prefixes = CATEGORIES[category];
  const filtered = logs.filter((l) => {
    if (prefixes.length && !prefixes.some((p) => l.action.startsWith(p))) return false;
    if (query && !l.action.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <Heading level={1} >Your activity</Heading>
          <p className="text-description-sm">Logins, profile changes, jobs, bookings, payments, and verifications.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="md:max-w-sm"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(CATEGORIES).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-description-sm">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-description-sm">No activity yet.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((l) => (
                <li key={l.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={badgeVariant(l.action)}>{labelFor(l.action)}</Badge>
                      {l.entity_type && (
                        <span className="text-xs text-muted-foreground">{l.entity_type}</span>
                      )}
                    </div>
                    {l.details && Object.keys(l.details).length > 0 && (
                      <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted/40 p-2 rounded-sm">
                        {JSON.stringify(l.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}