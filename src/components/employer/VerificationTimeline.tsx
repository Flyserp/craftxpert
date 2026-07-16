import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  Clock,
  FileText,
  History,
  MessageSquare,
  RefreshCw,
  Send,
  XCircle,
  Upload,
  FileUp,
  FileX,
  Loader2,
} from "lucide-react";

type HistoryEntry = {
  id: string;
  event: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  reasons: string[] | null;
  actor_role: string | null;
  created_at: string;
};

const EVENT_META: Record<string, { label: string; icon: typeof Send; tone: string }> = {
  created: { label: "Verification started", icon: FileText, tone: "text-muted-foreground" },
  submitted: { label: "Submitted for review", icon: Send, tone: "text-primary" },
  resubmitted: { label: "Resubmitted for review", icon: RefreshCw, tone: "text-primary" },
  approved: { label: "Approved by admin", icon: BadgeCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rejected by admin", icon: XCircle, tone: "text-destructive" },
  info_requested: { label: "More info requested", icon: MessageSquare, tone: "text-blue-600 dark:text-blue-400" },
  expired: { label: "Verification expired", icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  document_uploaded: { label: "Document uploaded", icon: Upload, tone: "text-muted-foreground" },
  document_replaced: { label: "Document replaced", icon: FileUp, tone: "text-muted-foreground" },
  document_removed: { label: "Document removed", icon: FileX, tone: "text-muted-foreground" },
  status_change: { label: "Status changed", icon: History, tone: "text-muted-foreground" },
};

type Props = {
  userId: string;
  className?: string;
  limit?: number;
};

/**
 * Read-only verification progress timeline for the employer's own profile.
 * Renders history rows written by the `verification_status_history` trigger.
 */
export default function VerificationTimeline({ userId, className, limit }: Props) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data }, { data: vrow }] = await Promise.all([
        supabase
          .from("verification_status_history")
          .select("id,event,from_status,to_status,note,reasons,actor_role,created_at")
          .eq("vendor_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("vendor_verifications")
          .select("expires_at,status")
          .eq("vendor_id", userId)
          .maybeSingle(),
      ]);
      if (!active) return;
      setHistory((data ?? []) as HistoryEntry[]);
      setExpiresAt(
        vrow && (vrow as { status?: string; expires_at?: string | null }).status === "approved"
          ? ((vrow as { expires_at?: string | null }).expires_at ?? null)
          : null,
      );
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (history === null) {
    return (
      <Card className={cn("p-5 flex items-center gap-2 text-fs-sm text-muted-foreground", className)}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading verification timeline…
      </Card>
    );
  }

  const current = history[0];
  const currentMeta = current ? EVENT_META[current.event] ?? EVENT_META.status_change : null;
  const rows = typeof limit === "number" ? history.slice(0, limit) : history;

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <Heading level={2} className="text-foreground">Verification progress</Heading>
        </div>
        {currentMeta && (
          <span className={cn("inline-flex items-center gap-1.5 text-fs-xs font-medium", currentMeta.tone)}>
            <currentMeta.icon className="w-3.5 h-3.5" />
            {currentMeta.label}
            <span className="text-muted-foreground font-normal">
              · {new Date(current.created_at).toLocaleDateString()}
            </span>
          </span>
        )}
      </div>

      {expiresAt && (() => {
        const ms = new Date(expiresAt).getTime() - Date.now();
        const days = Math.ceil(ms / 86400000);
        const expired = days <= 0;
        const urgent = !expired && days <= 7;
        const soon = !expired && !urgent && days <= 30;
        const tone = expired || urgent
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : soon
          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
        const label = expired
          ? "Your verification has expired — renew to keep your Verified badge."
          : days === 1
          ? "Verification expires tomorrow — renew soon."
          : `Verification expires in ${days} days.`;
        return (
          <div className={cn("flex items-center gap-2 border rounded-sm px-3 py-2 mb-4 text-fs-xs font-medium", tone)}>
            <Clock className="w-3.5 h-3.5" />
            <span>{label}</span>
            <span className="opacity-70 font-normal">
              · {new Date(expiresAt).toLocaleDateString()}
            </span>
          </div>
        );
      })()}


      {history.length === 0 ? (
        <p className="text-fs-sm text-muted-foreground">
          No verification activity yet. Submit your documents to start the review process.
        </p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-5">
          {rows.map((h) => {
            const em = EVENT_META[h.event] ?? EVENT_META.status_change;
            const Icon = em.icon;
            return (
              <li key={h.id} className="pl-6 relative">
                <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                  <Icon className={cn("w-2.5 h-2.5", em.tone)} />
                </span>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className={cn("text-fs-sm font-medium", em.tone)}>{em.label}</p>
                  <time className="text-fs-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                  </time>
                </div>
                {h.actor_role && (
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">
                    by {h.actor_role}
                  </p>
                )}
                {h.note && (
                  <p className="text-fs-sm text-body mt-1.5 whitespace-pre-wrap">{h.note}</p>
                )}
                {h.reasons && h.reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {h.reasons.map((r) => (
                      <li key={r} className="text-fs-xs text-muted-foreground flex gap-1.5">
                        <span className="text-destructive">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {typeof limit === "number" && history.length > limit && (
        <p className="text-fs-xs text-muted-foreground mt-4">
          Showing {limit} of {history.length} events.
        </p>
      )}
    </Card>
  );
}
