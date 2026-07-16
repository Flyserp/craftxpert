import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileCheck2,
  Loader2,
  AlertCircle,
  Trash2,
  BadgeCheck,
  Clock,
  History,
  Send,
  FileText,
  RefreshCw,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/app";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { notifyVerificationResubmitted } from "@/lib/notifications";
import {
  VERIFICATION_BUCKET,
  STATUS_META,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/verification";

type HistoryEntry = {
  id: string;
  event: string;
  from_status: VerificationStatus | null;
  to_status: VerificationStatus;
  note: string | null;
  reasons: string[] | null;
  actor_role: string | null;
  created_at: string;
};

const EVENT_META: Record<
  string,
  { label: string; icon: typeof Send; tone: string }
> = {
  created: { label: "Verification started", icon: FileText, tone: "text-muted-foreground" },
  submitted: { label: "Submitted for review", icon: Send, tone: "text-primary" },
  resubmitted: { label: "Resubmitted for review", icon: RefreshCw, tone: "text-primary" },
  approved: { label: "Approved by admin", icon: BadgeCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rejected by admin", icon: XCircle, tone: "text-destructive" },
  info_requested: { label: "More info requested", icon: MessageSquare, tone: "text-blue-600 dark:text-blue-400" },
  expired: { label: "Verification expired", icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  status_change: { label: "Status changed", icon: History, tone: "text-muted-foreground" },
};


/**
 * Employer-facing KYC submission page.
 *
 * Reuses the same `vendor_verifications` table + admin queue that providers
 * use, but with the document set the spec requires for businesses posting jobs:
 *   - Company registration certificate (required)
 *   - Proof of business address (required)
 *   - Tax clearance certificate (optional)
 *
 * A DB trigger keeps `employer_profiles.verification_status` in sync as an
 * admin approves / rejects the submission.
 */

type DocKey =
  | "business_registration_url"
  | "proof_of_address_url"
  | "tax_certificate_url";

const EMPLOYER_DOCS: ReadonlyArray<{
  key: DocKey;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    key: "business_registration_url",
    label: "Company registration certificate",
    description:
      "Certificate of incorporation, trade licence, or equivalent registration document.",
    required: true,
  },
  {
    key: "proof_of_address_url",
    label: "Proof of business address",
    description:
      "Utility bill or lease agreement issued within the last 3 months.",
    required: true,
  },
  {
    key: "tax_certificate_url",
    label: "Tax clearance certificate",
    description: "Tax compliance / VAT registration certificate (optional).",
    required: false,
  },
];

const hasAllRequired = (row: Partial<VerificationRow> | null) =>
  !!row &&
  EMPLOYER_DOCS.filter((d) => d.required).every(
    (d) => !!(row as Record<string, unknown>)[d.key],
  );

export default function EmployerVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<VerificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const status: VerificationStatus = row?.status ?? "draft";
  const editable =
    status === "draft" || status === "rejected" || status === "info_requested";
  const isResubmit = status === "rejected" || status === "info_requested";
  const meta = STATUS_META[status];

  const loadHistory = async (verificationId: string) => {
    const { data } = await supabase
      .from("verification_status_history")
      .select("id,event,from_status,to_status,note,reasons,actor_role,created_at")
      .eq("verification_id", verificationId)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as HistoryEntry[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: verifRow }, { data: empRow }] = await Promise.all([
        supabase
          .from("vendor_verifications")
          .select("*")
          .eq("vendor_id", user.id)
          .maybeSingle(),
        supabase
          .from("employer_profiles")
          .select("company_name")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setRow(verifRow ?? null);
      setCompanyName(verifRow?.business_name ?? empRow?.company_name ?? "");
      setLegalName(verifRow?.legal_name ?? "");
      if (verifRow?.id) await loadHistory(verifRow.id);
      setLoading(false);
    })();
  }, [user]);


  const ensureRow = async (): Promise<VerificationRow | null> => {
    if (!user) return null;
    if (row) return row;
    const { data, error } = await supabase
      .from("vendor_verifications")
      .insert({ vendor_id: user.id, status: "draft" })
      .select()
      .single();
    if (error) {
      toast.error("Couldn't start verification — try again.");
      return null;
    }
    setRow(data);
    return data;
  };

  const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const handleUpload = async (key: DocKey, file: File) => {
    if (!user) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File must be smaller than 10 MB");
      return;
    }
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIMES.includes(mime)) {
      toast.error("Only JPG, PNG, WEBP, or PDF files are allowed");
      return;
    }
    setUploading(key);
    const current = await ensureRow();
    if (!current) {
      setUploading(null);
      return;
    }
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${key}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, file, { upsert: false, contentType: mime });
    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setUploading(null);
      return;
    }
    const { error: updateErr } = await supabase
      .from("vendor_verifications")
      .update({ [key]: path } as never)
      .eq("id", current.id);
    if (updateErr) {
      // Server-side validation rejected the file — remove the orphan upload.
      await supabase.storage.from(VERIFICATION_BUCKET).remove([path]);
      toast.error(updateErr.message || "This file didn't pass verification checks.");
    } else {
      setRow({ ...current, [key]: path });
      toast.success("Document uploaded");
    }
    setUploading(null);
  };


  const handleRemove = async (key: DocKey) => {
    if (!row) return;
    const path = (row as Record<string, unknown>)[key] as string | null;
    if (path) await supabase.storage.from(VERIFICATION_BUCKET).remove([path]);
    const { error } = await supabase
      .from("vendor_verifications")
      .update({ [key]: null } as never)
      .eq("id", row.id);
    if (error) {
      toast.error("Couldn't remove document");
    } else {
      setRow({ ...row, [key]: null });
    }
  };

  const handleSubmit = async () => {
    if (!row) return;
    if (!companyName.trim() || !legalName.trim()) {
      toast.error("Please add your company name and legal representative.");
      return;
    }
    if (!hasAllRequired(row)) {
      toast.error("Please upload all required documents.");
      return;
    }
    setSaving(true);

    // Resubmissions & renewals go through the authenticated re-verify endpoint,
    // which extends `expires_at` and notifies the moderation queue. First-time
    // submissions keep the original client-side path (no expiry to extend yet).
    if (isResubmit || status === "approved") {
      const { data, error } = await supabase.functions.invoke("employer-reverify", {
        body: {
          verification_id: row.id,
          business_name: companyName.trim(),
          legal_name: legalName.trim(),
        },
      });
      setSaving(false);
      if (error || (data && (data as { error?: string }).error)) {
        const msg = (data as { error?: string; missing?: string[] } | null)?.error || error?.message;
        toast.error(msg || "Couldn't submit — try again.");
        return;
      }
      const newExpiresAt =
        (data as { expires_at?: string } | null)?.expires_at ?? row.expires_at ?? null;
      toast.success("Resubmitted for review");
      setRow({
        ...row,
        status: "pending",
        submitted_at: new Date().toISOString(),
        expires_at: newExpiresAt,
        rejection_note: null,
        rejection_reasons: [],
        info_request_note: null,
      } as VerificationRow);
      await loadHistory(row.id);
      return;
    }

    const { error } = await supabase
      .from("vendor_verifications")
      .update({
        status: "pending",
        business_name: companyName.trim(),
        legal_name: legalName.trim(),
        submitted_at: new Date().toISOString(),
        rejection_note: null,
        rejection_reasons: [],
        info_request_note: null,
        info_request_items: [] as never,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't submit — try again.");
      return;
    }
    toast.success("Submitted for review");
    setRow({ ...row, status: "pending", submitted_at: new Date().toISOString(), rejection_note: null, rejection_reasons: [], info_request_note: null });
    if (user) {
      await notifyVerificationResubmitted({
        vendorId: user.id,
        vendorName: companyName.trim() || undefined,
        businessName: companyName.trim() || null,
        verificationId: row.id,
        actorId: user.id,
      });
    }
    await loadHistory(row.id);
  };


  return (
    <DashboardLayout
      title="Verify your company"
      subtitle="Upload your business documents to earn a Verified badge on your job posts."
      actions={
        <Button variant="ghost" onClick={() => navigate("/employer-dashboard")}>
          Back to dashboard
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {/* Status header */}
          <Card className="p-5 flex items-center gap-4">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-fs-xs font-semibold",
                meta.tone,
              )}
            >
              {status === "approved" && <BadgeCheck className="w-3.5 h-3.5" />}
              {status === "pending" && <Clock className="w-3.5 h-3.5" />}
              {status === "rejected" && <AlertCircle className="w-3.5 h-3.5" />}
              {meta.label}
            </span>
            {status === "pending" && (
              <p className="text-fs-sm text-muted-foreground">
                Locked while under review. We'll email you when there's an update.
              </p>
            )}
            {status === "approved" && (
              <div className="text-fs-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Reviewed on{" "}
                  {row?.reviewed_at
                    ? new Date(row.reviewed_at).toLocaleDateString()
                    : "—"}
                </span>
                {(() => {
                  const expIso = (row as unknown as { expires_at?: string | null } | null)?.expires_at;
                  if (!expIso) return null;
                  const ms = new Date(expIso).getTime() - Date.now();
                  const days = Math.ceil(ms / 86400000);
                  const expired = days <= 0;
                  const soon = days > 0 && days <= 30;
                  const urgent = days > 0 && days <= 7;
                  const tone = expired
                    ? "text-destructive"
                    : urgent
                    ? "text-destructive"
                    : soon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400";
                  const label = expired
                    ? "Expired — renew to keep your Verified badge"
                    : days === 1
                    ? "Expires tomorrow"
                    : `Expires in ${days} days`;
                  return (
                    <span className={cn("inline-flex items-center gap-1 font-medium", tone)}>
                      <Clock className="w-3.5 h-3.5" />
                      {label}
                      <span className="text-muted-foreground font-normal">
                        · {new Date(expIso).toLocaleDateString()}
                      </span>
                    </span>
                  );
                })()}
              </div>
            )}
          </Card>

          {/* Reviewer feedback */}
          {(status === "rejected" || status === "info_requested") && (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Heading level={3} className="text-foreground mb-1">
                    {status === "info_requested"
                      ? "Admin requested more information"
                      : "Reviewer's notes"}
                  </Heading>
                  {status === "info_requested" && row?.info_request_note && (
                    <p className="text-fs-sm text-body mb-3 whitespace-pre-wrap">
                      {row.info_request_note}
                    </p>
                  )}
                  {status === "info_requested" && Array.isArray((row as unknown as { info_request_items?: Array<{ kind: string; key: string; label: string }> } | null)?.info_request_items) && ((row as unknown as { info_request_items: Array<{ kind: string; key: string; label: string }> }).info_request_items.length > 0) && (
                    <>
                      <p className="text-fs-xs font-semibold text-muted-foreground mb-2">
                        Please update the following:
                      </p>
                      <ul className="space-y-1 mb-3">
                        {(row as unknown as { info_request_items: Array<{ kind: string; key: string; label: string }> }).info_request_items.map((item) => (
                          <li
                            key={`${item.kind}-${item.key}`}
                            className="text-fs-sm text-body flex items-start gap-2"
                          >
                            <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                            <span>
                              {item.label}
                              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {item.kind === "doc" ? "Document" : "Field"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {row?.rejection_note && (
                    <p className="text-fs-sm text-body mb-3 whitespace-pre-wrap">
                      {row.rejection_note}
                    </p>
                  )}
                  {row?.rejection_reasons && row.rejection_reasons.length > 0 && (
                    <>
                      <p className="text-fs-xs font-semibold text-muted-foreground mb-2">
                        Please fix:
                      </p>
                      <ul className="space-y-1">
                        {row.rejection_reasons.map((r) => (
                          <li
                            key={r}
                            className="text-fs-sm text-body flex items-start gap-2"
                          >
                            <span className="text-destructive mt-0.5">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="text-fs-xs text-muted-foreground mt-3">
                    Update the affected documents or details below, then resubmit — your submission history is preserved.
                  </p>
                </div>
              </div>
            </Card>
          )}


          {/* Company details */}
          <Card className="p-5 space-y-4">
            <Heading level={2} className="text-foreground">
              Company details
            </Heading>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Registered company name</Label>
                <Input
                  id="company_name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Zimbabwe (Pvt) Ltd"
                  disabled={!editable}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legal_name">Authorised representative</Label>
                <Input
                  id="legal_name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Full name as on ID"
                  disabled={!editable}
                  maxLength={120}
                />
              </div>
            </div>
          </Card>

          {/* Documents */}
          <Card className="p-5 space-y-4">
            <Heading level={2} className="text-foreground">
              Documents
            </Heading>
            <div className="space-y-3">
              {EMPLOYER_DOCS.map((doc) => {
                const path = (row as Record<string, unknown> | null)?.[doc.key] as
                  | string
                  | null
                  | undefined;
                const isUploading = uploading === doc.key;
                return (
                  <div
                    key={doc.key}
                    className="border border-border rounded-lg p-4 flex items-start gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-fs-sm font-medium text-foreground">
                          {doc.label}
                        </p>
                        {doc.required ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive/80">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Optional
                          </span>
                        )}
                        {path && (
                          <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-fs-xs text-muted-foreground">
                        {doc.description}
                      </p>
                      {path && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {path.split("/").pop()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editable && (
                        <>
                          <label
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-fs-xs font-medium border border-border bg-background hover:bg-muted cursor-pointer transition-colors",
                              isUploading && "opacity-60 pointer-events-none",
                            )}
                          >
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {path ? "Replace" : "Upload"}
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(doc.key, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {path && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemove(doc.key)}
                              aria-label={`Remove ${doc.label}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Submit */}
          {editable && (
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={saving || !hasAllRequired(row) || !companyName.trim() || !legalName.trim()}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isResubmit ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isResubmit ? "Resubmit for review" : "Submit for review"}
              </Button>
            </div>
          )}

          {/* Status history timeline */}
          {history.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-muted-foreground" />
                <Heading level={2} className="text-foreground">
                  Status history
                </Heading>
              </div>
              <ol className="relative border-l border-border ml-2 space-y-5">
                {history.map((h) => {
                  const em = EVENT_META[h.event] ?? EVENT_META.status_change;
                  const Icon = em.icon;
                  return (
                    <li key={h.id} className="pl-6 relative">
                      <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                        <Icon className={cn("w-2.5 h-2.5", em.tone)} />
                      </span>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <p className={cn("text-fs-sm font-medium", em.tone)}>
                          {em.label}
                        </p>
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
                        <p className="text-fs-sm text-body mt-1.5 whitespace-pre-wrap">
                          {h.note}
                        </p>
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
            </Card>
          )}
        </div>
      )}

    </DashboardLayout>
  );
}
