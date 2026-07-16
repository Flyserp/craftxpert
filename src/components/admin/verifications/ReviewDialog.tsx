import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ExternalLink,
  ShieldCheck,
  X,
  FileText,
  HelpCircle,
  History,
  Send,
  RefreshCw,
  BadgeCheck,
  XCircle,
  MessageSquare,
  FilePlus2,
  FileMinus2,
  FileEdit,
  Clock,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SuccessButton, DangerButton, InfoButton } from "@/components/ui/app";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  REJECTION_REASONS,
  REQUESTABLE_FIELDS,
  VERIFICATION_BUCKET,
  VERIFICATION_DOCS,
  type InfoRequestItem,
  type VerificationRow,
} from "@/lib/verification";
import {
  notifyVerificationApproved,
  notifyVerificationRejected,
  notifyVerificationInfoRequested,
} from "@/lib/notifications";
import DocumentChangeViewer from "./DocumentChangeViewer";

type AuditEntry = {
  id: string;
  event: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  reasons: string[] | null;
  actor_id: string | null;
  actor_role: string | null;
  created_at: string;
};

const EVENT_META: Record<string, { label: string; icon: typeof Send; tone: string }> = {
  created: { label: "Verification started", icon: FileText, tone: "text-muted-foreground" },
  submitted: { label: "Submitted for review", icon: Send, tone: "text-primary" },
  resubmitted: { label: "Resubmitted for review", icon: RefreshCw, tone: "text-primary" },
  approved: { label: "Approved", icon: BadgeCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rejected", icon: XCircle, tone: "text-destructive" },
  info_requested: { label: "Info requested", icon: MessageSquare, tone: "text-blue-600 dark:text-blue-400" },
  expired: { label: "Expired", icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  document_uploaded: { label: "Document uploaded", icon: FilePlus2, tone: "text-primary" },
  document_replaced: { label: "Document replaced", icon: FileEdit, tone: "text-amber-600 dark:text-amber-400" },
  document_removed: { label: "Document removed", icon: FileMinus2, tone: "text-destructive" },
  status_change: { label: "Status changed", icon: History, tone: "text-muted-foreground" },
};


interface ReviewDialogProps {
  row: VerificationRow | null;
  vendorName?: string;
  vendorEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}

/**
 * Admin review dialog: lists submitted docs (with signed-URL preview links) and
 * exposes Approve / Reject actions. Reject requires a free-text note OR at least
 * one suggested-fix checklist item.
 */
export default function AdminVerificationReviewDialog({
  row,
  vendorName,
  vendorEmail,
  open,
  onOpenChange,
  onReviewed,
}: ReviewDialogProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | "info" | null>(null);
  const [infoNote, setInfoNote] = useState("");
  const [infoItems, setInfoItems] = useState<InfoRequestItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditKind, setAuditKind] = useState<"all" | "status" | "document">("all");
  const [auditFrom, setAuditFrom] = useState<string>("");
  const [auditTo, setAuditTo] = useState<string>("");
  const [auditQuery, setAuditQuery] = useState<string>("");

  const DOC_EVENTS = new Set(["document_uploaded", "document_replaced", "document_removed"]);
  const filteredAudit = useMemo(() => {
    const fromMs = auditFrom ? new Date(`${auditFrom}T00:00:00`).getTime() : null;
    const toMs = auditTo ? new Date(`${auditTo}T23:59:59.999`).getTime() : null;
    const q = auditQuery.trim().toLowerCase();
    return audit.filter((h) => {
      const isDoc = DOC_EVENTS.has(h.event);
      if (auditKind === "status" && isDoc) return false;
      if (auditKind === "document" && !isDoc) return false;
      const t = new Date(h.created_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      if (q) {
        const actorName = (h.actor_id && actorNames[h.actor_id]) || "";
        const haystack = [
          h.note ?? "",
          actorName,
          h.actor_role ?? "",
          h.event,
          (h.reasons ?? []).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [audit, auditKind, auditFrom, auditTo, auditQuery, actorNames]);

  const businessName =
    ((row as unknown as { business_name?: string } | null)?.business_name) ||
    vendorName ||
    "vendor";
  const exportSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "vendor";
  const exportStamp = new Date().toISOString().slice(0, 10);

  const buildExportRows = () =>
    filteredAudit.map((h) => {
      const em = EVENT_META[h.event] ?? EVENT_META.status_change;
      const actor =
        (h.actor_id && actorNames[h.actor_id]) ||
        (h.actor_role ? h.actor_role : "system");
      return {
        timestamp: new Date(h.created_at).toISOString(),
        event: em.label,
        event_key: h.event,
        from_status: h.from_status ?? "",
        to_status: h.to_status ?? "",
        actor,
        actor_role: h.actor_role ?? "",
        note: h.note ?? "",
        reasons: (h.reasons ?? []).join("; "),
      };
    });

  const handleExportCsv = () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.error("No entries to export");
      return;
    }
    const headers = [
      "timestamp",
      "event",
      "event_key",
      "from_status",
      "to_status",
      "actor",
      "actor_role",
      "note",
      "reasons",
    ] as const;
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, string>)[h] ?? "")).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification-audit_${exportSlug}_${exportStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} entries to CSV`);
  };

  const handleExportPdf = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.error("No entries to export");
      return;
    }
    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableModule as { default: (doc: unknown, opts: unknown) => void }).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(14);
      doc.text("Employer Verification Audit Log", 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Vendor: ${businessName}`, 40, 58);
      if (vendorEmail) doc.text(`Email: ${vendorEmail}`, 40, 72);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, vendorEmail ? 86 : 72);
      doc.text(
        `Entries: ${rows.length} of ${audit.length}` +
          (auditKind !== "all" ? ` · filter: ${auditKind}` : "") +
          (auditQuery ? ` · search: "${auditQuery}"` : "") +
          (auditFrom || auditTo ? ` · range: ${auditFrom || "…"} → ${auditTo || "…"}` : ""),
        40,
        vendorEmail ? 100 : 86,
      );

      autoTable(doc, {
        startY: vendorEmail ? 116 : 102,
        head: [["Timestamp", "Event", "From → To", "Actor", "Note", "Reasons"]],
        body: rows.map((r) => [
          new Date(r.timestamp).toLocaleString(),
          r.event,
          r.from_status || r.to_status ? `${r.from_status || "—"} → ${r.to_status || "—"}` : "—",
          r.actor_role ? `${r.actor} (${r.actor_role})` : r.actor,
          r.note,
          r.reasons,
        ]),
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [0, 39, 44], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 105 },
          1: { cellWidth: 105 },
          2: { cellWidth: 110 },
          3: { cellWidth: 110 },
          4: { cellWidth: "auto" },
          5: { cellWidth: 140 },
        },
        margin: { left: 40, right: 40 },
        didDrawPage: (data: { pageNumber: number }) => {
          const total = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(
            `Page ${data.pageNumber} of ${total}`,
            pageWidth - 40,
            doc.internal.pageSize.getHeight() - 20,
            { align: "right" },
          );
        },
      });

      doc.save(`verification-audit_${exportSlug}_${exportStamp}.pdf`);
      toast.success(`Exported ${rows.length} entries to PDF`);
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed to generate PDF");
    }
  };


  const docList = useMemo(
    () => {
      const statusMap = ((row as unknown as { document_status?: Record<string, { size?: number; mimetype?: string; checked_at?: string }> } | null)?.document_status) ?? {};
      return VERIFICATION_DOCS.map((d) => ({
        ...d,
        path: (row as Record<string, unknown> | null)?.[d.key] as string | null | undefined,
        meta: statusMap[d.key] ?? null,
      }));
    },
    [row],
  );

  const formatBytes = (n?: number) => {
    if (!n || n <= 0) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };
  const shortMime = (m?: string) => {
    if (!m) return "unknown";
    if (m === "application/pdf") return "PDF";
    if (m.startsWith("image/")) return m.slice(6).toUpperCase();
    return m;
  };



  // Generate short-lived signed URLs for any uploaded files so the admin
  // can preview docs from a private bucket.
  useEffect(() => {
    if (!row || !open) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const d of docList) {
        if (!d.path) continue;
        const { data } = await supabase.storage
          .from(VERIFICATION_BUCKET)
          .createSignedUrl(d.path, 600);
        if (data?.signedUrl) out[d.key] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls(out);
    })();
    // Reset rejection form whenever a new row is opened
    setNote("");
    setReasons([]);
    setInfoNote("");
    setInfoItems([]);
    return () => {
      cancelled = true;
    };
  }, [row, open, docList]);

  // Load full audit trail for this verification
  useEffect(() => {
    if (!row || !open) return;
    let cancelled = false;
    (async () => {
      setLoadingAudit(true);
      const { data } = await supabase
        .from("verification_status_history")
        .select("id,event,from_status,to_status,note,reasons,actor_id,actor_role,created_at")
        .eq("verification_id", row.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as AuditEntry[];
      setAudit(rows);
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", ids);
        if (!cancelled) {
          setActorNames(
            Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""])),
          );
        }
      } else {
        setActorNames({});
      }
      setLoadingAudit(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [row, open]);


  const toggleReason = (r: string) => {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const handleApprove = async () => {
    if (!row) return;
    setSubmitting("approve");
    const actorId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase
      .from("vendor_verifications")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
        rejection_note: null,
        rejection_reasons: [],
      })
      .eq("id", row.id);
    if (!error) {
      await notifyVerificationApproved({
        vendorId: row.vendor_id,
        vendorName,
        businessName: row.business_name,
        verificationId: row.id,
        actorId: actorId ?? undefined,
      });
    }
    setSubmitting(null);
    if (error) toast.error("Couldn't approve");
    else {
      toast.success("Vendor approved");
      onReviewed();
      onOpenChange(false);
    }
  };

  const handleReject = async () => {
    if (!row) return;
    if (!note.trim() && reasons.length === 0) {
      toast.error("Add a note or tick at least one suggested fix.");
      return;
    }
    setSubmitting("reject");
    const actorId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const rejectionNote = note.trim() || null;
    const { error } = await supabase
      .from("vendor_verifications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
        rejection_note: rejectionNote,
        rejection_reasons: reasons,
      })
      .eq("id", row.id);
    if (!error) {
      await notifyVerificationRejected({
        vendorId: row.vendor_id,
        vendorName,
        businessName: row.business_name,
        verificationId: row.id,
        rejectionNote,
        rejectionReasons: reasons,
        actorId: actorId ?? undefined,
      });
    }
    setSubmitting(null);
    if (error) toast.error("Couldn't reject");
    else {
      toast.success("Vendor notified to resubmit");
      onReviewed();
      onOpenChange(false);
    }
  };

  const toggleInfoItem = (item: InfoRequestItem) => {
    setInfoItems((prev) =>
      prev.some((p) => p.kind === item.kind && p.key === item.key)
        ? prev.filter((p) => !(p.kind === item.kind && p.key === item.key))
        : [...prev, item],
    );
  };
  const isInfoItemChecked = (kind: InfoRequestItem["kind"], key: string) =>
    infoItems.some((p) => p.kind === kind && p.key === key);

  const handleRequestInfo = async () => {
    if (!row) return;
    if (!infoNote.trim() && infoItems.length === 0) {
      toast.error("Pick at least one required item or add a note for the vendor.");
      return;
    }
    setSubmitting("info");
    const actorId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const trimmedNote = infoNote.trim();
    const { error } = await supabase
      .from("vendor_verifications")
      .update({
        status: "info_requested",
        info_request_note: trimmedNote || null,
        info_request_items: infoItems as unknown as never,
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
      })
      .eq("id", row.id);
    if (!error) {
      await notifyVerificationInfoRequested({
        vendorId: row.vendor_id,
        vendorName,
        businessName: row.business_name,
        verificationId: row.id,
        infoRequestNote: trimmedNote || (infoItems.length
          ? `Please update: ${infoItems.map((i) => i.label).join(", ")}`
          : ""),
        actorId: actorId ?? undefined,
      });
    }
    setSubmitting(null);
    if (error) toast.error("Couldn't send request");
    else {
      toast.success("Vendor asked to update the selected items");
      onReviewed();
      onOpenChange(false);
    }
  };


  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review verification</DialogTitle>
          <DialogDescription>
            {vendorName ?? "Vendor"} {vendorEmail ? `· ${vendorEmail}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="review" className="py-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="changes" className="gap-1.5">
              <FileEdit className="w-3.5 h-3.5" />
              Changes
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="w-3.5 h-3.5" />
              Audit log
              {audit.length > 0 && (
                <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">
                  {audit.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-5 mt-4">
            {/* Submitted details */}
            <div className="grid sm:grid-cols-2 gap-3 text-fs-sm">
              <div>
                <p className="text-fs-xs text-muted-foreground">Business name</p>
                <p className="font-medium text-foreground">{row.business_name || "—"}</p>
              </div>
              <div>
                <p className="text-fs-xs text-muted-foreground">Legal name</p>
                <p className="font-medium text-foreground">{row.legal_name || "—"}</p>
              </div>
              <div>
                <p className="text-fs-xs text-muted-foreground">Submitted</p>
                <p className="font-medium text-foreground">
                  {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"}
                </p>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <p className="text-fs-sm font-semibold text-foreground">Documents</p>
              {docList.map((d) => {
                const missingRequired = d.required && !d.path;
                const validated = !!d.path && !!d.meta;
                return (
                  <div
                    key={d.key}
                    className={cn(
                      "flex items-center gap-3 border rounded-sm p-3",
                      missingRequired ? "border-destructive/40 bg-destructive/5" : "border-border",
                    )}
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-fs-sm font-medium text-foreground">{d.label}</p>
                        {d.required && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Required</span>
                        )}
                        {validated && (
                          <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            {shortMime(d.meta?.mimetype)} · {formatBytes(d.meta?.size)}
                          </span>
                        )}
                        {d.path && !d.meta && (
                          <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Not validated
                          </span>
                        )}
                        {missingRequired && (
                          <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20">
                            Missing
                          </span>
                        )}
                      </div>
                      <p className="text-fs-xs text-muted-foreground truncate">
                        {d.path ? d.path.split("/").pop() : "Not uploaded"}
                      </p>
                    </div>
                    {d.path && signedUrls[d.key] && (
                      <a
                        href={signedUrls[d.key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-fs-xs font-medium text-primary hover:underline"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>


            {/* Reject form */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-fs-sm font-semibold text-foreground">If rejecting, tell the vendor what to fix</p>
              <div className="space-y-2">
                {REJECTION_REASONS.map((r) => (
                  <label key={r} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={reasons.includes(r)}
                      onCheckedChange={() => toggleReason(r)}
                      id={`reason-${r}`}
                    />
                    <span className="text-fs-sm text-body leading-snug">{r}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Additional note (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything else the vendor should know…"
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>

            {/* Request additional documents / fields */}
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <p className="text-fs-sm font-semibold text-foreground">Or request specific items</p>
                <p className="text-fs-xs text-muted-foreground">
                  Tick the exact documents or profile fields the vendor must update. Ticked items appear in their verification timeline.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">Documents</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {VERIFICATION_DOCS.map((d) => (
                    <label key={`doc-${d.key}`} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={isInfoItemChecked("doc", d.key)}
                        onCheckedChange={() => toggleInfoItem({ kind: "doc", key: d.key, label: d.label })}
                        id={`info-doc-${d.key}`}
                      />
                      <span className="text-fs-sm text-body leading-snug">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">Profile fields</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {REQUESTABLE_FIELDS.map((f) => (
                    <label key={`field-${f.key}`} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={isInfoItemChecked("field", f.key)}
                        onCheckedChange={() => toggleInfoItem({ kind: "field", key: f.key, label: f.label })}
                        id={`info-field-${f.key}`}
                      />
                      <span className="text-fs-sm text-body leading-snug">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="info-note">Additional instructions (optional)</Label>
                <Textarea
                  id="info-note"
                  value={infoNote}
                  onChange={(e) => setInfoNote(e.target.value)}
                  placeholder="e.g. Please upload a clearer copy of your tax certificate."
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="changes" className="mt-4">
            <DocumentChangeViewer audit={audit} />
          </TabsContent>

          <TabsContent value="audit" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="space-y-2 border border-border rounded-sm p-2.5 bg-muted/30">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  placeholder="Search by admin/employer name, note keywords, reasons…"
                  className="h-8 w-full rounded-sm border border-border bg-background pl-7 pr-8 text-fs-xs"
                  aria-label="Search audit log"
                />
                {auditQuery && (
                  <button
                    type="button"
                    onClick={() => setAuditQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex items-center gap-1">
                  {(["all", "status", "document"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAuditKind(k)}
                      className={cn(
                        "text-fs-xs px-2 py-1 rounded-sm border transition-colors",
                        auditKind === k
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {k === "all" ? "All events" : k === "status" ? "Status changes" : "Document changes"}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2 ml-auto">
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="audit-from" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      From
                    </label>
                    <input
                      id="audit-from"
                      type="date"
                      value={auditFrom}
                      max={auditTo || undefined}
                      onChange={(e) => setAuditFrom(e.target.value)}
                      className="h-8 rounded-sm border border-border bg-background px-2 text-fs-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="audit-to" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      To
                    </label>
                    <input
                      id="audit-to"
                      type="date"
                      value={auditTo}
                      min={auditFrom || undefined}
                      onChange={(e) => setAuditTo(e.target.value)}
                      className="h-8 rounded-sm border border-border bg-background px-2 text-fs-xs"
                    />
                  </div>
                  {(auditFrom || auditTo || auditKind !== "all" || auditQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuditKind("all");
                        setAuditFrom("");
                        setAuditTo("");
                        setAuditQuery("");
                      }}
                      className="h-8 px-2 text-fs-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-auto">
                  Export {filteredAudit.length} {filteredAudit.length === 1 ? "entry" : "entries"} for compliance
                </span>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredAudit.length === 0}
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-fs-xs rounded-sm border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={filteredAudit.length === 0}
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-fs-xs rounded-sm border border-primary bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>

            {loadingAudit ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : audit.length === 0 ? (
              <p className="text-fs-sm text-muted-foreground text-center py-8">
                No audit entries yet.
              </p>
            ) : filteredAudit.length === 0 ? (
              <p className="text-fs-sm text-muted-foreground text-center py-8">
                No entries match the selected filters.
              </p>
            ) : (
              <>
                <p className="text-fs-xs text-muted-foreground">
                  Showing {filteredAudit.length} of {audit.length} events
                </p>
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {filteredAudit.map((h) => {
                    const em = EVENT_META[h.event] ?? EVENT_META.status_change;
                    const Icon = em.icon;
                    const actor =
                      (h.actor_id && actorNames[h.actor_id]) ||
                      (h.actor_role ? h.actor_role : "system");
                    return (
                      <li key={h.id} className="pl-6 relative">
                        <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                          <Icon className={cn("w-2.5 h-2.5", em.tone)} />
                        </span>
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <p className={cn("text-fs-sm font-medium", em.tone)}>
                            {em.label}
                            {h.from_status && h.from_status !== h.to_status && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                · {h.from_status} → {h.to_status}
                              </span>
                            )}
                          </p>
                          <time className="text-fs-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString()}
                          </time>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          by {actor}
                          {h.actor_role && actor !== h.actor_role ? ` (${h.actor_role})` : ""}
                        </p>
                        {h.note && (
                          <p className="text-fs-sm text-body mt-1 whitespace-pre-wrap break-all">
                            {h.note}
                          </p>
                        )}
                        {h.reasons && h.reasons.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
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
              </>
            )}
          </TabsContent>
        </Tabs>



        <DialogFooter className="gap-2 sm:gap-2">
          <InfoButton
            onClick={handleRequestInfo}
            disabled={submitting !== null}
            className="gap-1.5"
          >
            {submitting === "info" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5" />}
            Request more info
          </InfoButton>
          <DangerButton
            onClick={handleReject}
            disabled={submitting !== null}
            className="gap-1.5"
          >
            {submitting === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Reject & request changes
          </DangerButton>
          <SuccessButton
            onClick={handleApprove}
            disabled={submitting !== null}
            className="gap-1.5"
          >
            {submitting === "approve" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            Approve
          </SuccessButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
