import {
  FileEdit, Send, Inbox, Star, CheckCircle2, PlayCircle, Trophy,
  XCircle, AlertTriangle, Lock, type LucideIcon,
} from "lucide-react";

export type JobStatus =
  | "draft" | "published" | "applied" | "shortlisted" | "accepted"
  | "in_progress" | "completed" | "cancelled" | "disputed" | "closed";

/** Map legacy/raw `tasks.status` values from the DB into the canonical lifecycle. */
export function normalizeJobStatus(
  raw: string | null | undefined,
  ctx: { proposalCount?: number; hasShortlisted?: boolean; hasAccepted?: boolean; hasDispute?: boolean } = {},
): JobStatus {
  const s = (raw ?? "").toLowerCase();
  if (ctx.hasDispute) return "disputed";
  if (s === "draft") return "draft";
  if (s === "closed") return "closed";
  if (s === "expired") return "closed";
  if (s === "cancelled") return "cancelled";
  if (s === "completed") return "completed";
  if (s === "in_progress") return "in_progress";
  if (s === "accepted" || ctx.hasAccepted) return "accepted";
  if (s === "shortlisted" || ctx.hasShortlisted) return "shortlisted";
  if (s === "open" || s === "published") {
    if ((ctx.proposalCount ?? 0) > 0) return "applied";
    return "published";
  }
  return "published";
}

export const JOB_STATUS_ORDER: JobStatus[] = [
  "draft", "published", "applied", "shortlisted",
  "accepted", "in_progress", "completed", "closed",
];

export const JOB_STATUS_META: Record<JobStatus, {
  label: string; icon: LucideIcon; tone: string; help: string;
}> = {
  draft:       { label: "Draft",       icon: FileEdit,      tone: "bg-muted text-muted-foreground",                 help: "Saved but not yet published." },
  published:   { label: "Published",   icon: Send,          tone: "bg-primary/10 text-primary",                     help: "Live and accepting applications." },
  applied:     { label: "Applied",     icon: Inbox,         tone: "bg-primary/10 text-primary",                     help: "Providers have submitted proposals." },
  shortlisted: { label: "Shortlisted", icon: Star,          tone: "bg-accent text-accent-foreground",               help: "Top candidates flagged for review." },
  accepted:    { label: "Accepted",    icon: CheckCircle2,  tone: "bg-accent text-accent-foreground",               help: "A provider has been hired." },
  in_progress: { label: "In Progress", icon: PlayCircle,    tone: "bg-primary text-primary-foreground",             help: "Work is underway." },
  completed:   { label: "Completed",   icon: Trophy,        tone: "bg-primary text-primary-foreground",             help: "Provider marked the job complete." },
  cancelled:   { label: "Cancelled",   icon: XCircle,       tone: "bg-destructive/10 text-destructive",             help: "Job was cancelled." },
  disputed:    { label: "Disputed",    icon: AlertTriangle, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", help: "A dispute has been opened." },
  closed:      { label: "Closed",      icon: Lock,          tone: "bg-muted text-muted-foreground",                 help: "Job is closed and archived." },
};