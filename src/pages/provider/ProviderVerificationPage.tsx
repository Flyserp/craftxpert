import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileCheck2, Loader2, AlertCircle, Trash2, BadgeCheck, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  VERIFICATION_BUCKET,
  VERIFICATION_DOCS,
  STATUS_META,
  hasAllRequiredDocs,
  type VerificationDocKey,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/verification";
import { Heading } from "@/components/ui/app";

/**
 * Provider-facing KYC submission page.
 * - Loads the existing verification row (if any) on mount.
 * - Lets the vendor fill business/legal name and upload up to 5 documents.
 * - Editable only when status is `draft` or `rejected`.
 * - Submitting transitions status → `pending` (admin queue picks it up).
 */
export default function ProviderVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<VerificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<VerificationDocKey | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");

  const status: VerificationStatus = row?.status ?? "draft";
  const editable = status === "draft" || status === "rejected" || status === "info_requested";
  const meta = STATUS_META[status];

  const expiresAt = (row as { expires_at?: string | null } | null)?.expires_at ?? null;
  const expMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const daysLeft = expMs ? Math.ceil((expMs - Date.now()) / 86_400_000) : null;
  const isExpired = expMs !== null && expMs <= Date.now();
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
  const canRenew = status === "approved" && (isExpired || isExpiringSoon);
  const [renewing, setRenewing] = useState(false);
  const RENEWAL_FEE = 10;

  const handleRenew = async () => {
    if (!user || !row) return;
    setRenewing(true);
    try {
      // Simulated payment — record a transaction and extend the verification.
      await (supabase as any).from("payment_transactions").insert({
        user_id: user.id,
        amount: RENEWAL_FEE,
        payment_method: "wallet",
        payment_type: "verification_renewal",
        status: "completed",
      });
      const base = isExpired ? new Date() : new Date(expMs!);
      const newExp = new Date(base);
      newExp.setFullYear(newExp.getFullYear() + 1);
      const { data, error } = await supabase
        .from("vendor_verifications")
        .update({
          expires_at: newExp.toISOString(),
          last_renewed_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      setRow(data as VerificationRow);
      toast.success(`Verification renewed until ${newExp.toLocaleDateString()}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Renewal failed");
    } finally {
      setRenewing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("vendor_verifications")
        .select("*")
        .eq("vendor_id", user.id)
        .maybeSingle();
      setRow(data);
      setBusinessName(data?.business_name ?? "");
      setLegalName(data?.legal_name ?? "");
      setLoading(false);
    })();
  }, [user]);

  /** Ensure a row exists so subsequent uploads have an id to attach to. */
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

  const handleUpload = async (key: VerificationDocKey, file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be smaller than 10 MB");
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
      .upload(path, file, { upsert: false });
    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setUploading(null);
      return;
    }
    // Dynamic-key update: cast to satisfy strict generated Update typing.
    const { error: updateErr } = await supabase
      .from("vendor_verifications")
      .update({ [key]: path } as never)
      .eq("id", current.id);
    if (updateErr) {
      toast.error("Saved file but couldn't link it.");
    } else {
      setRow({ ...current, [key]: path });
      toast.success("Document uploaded");
    }
    setUploading(null);
  };

  const handleRemove = async (key: VerificationDocKey) => {
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

  const handleSaveDetails = async () => {
    if (!row) {
      const created = await ensureRow();
      if (!created) return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("vendor_verifications")
      .update({ business_name: businessName.trim() || null, legal_name: legalName.trim() || null })
      .eq("vendor_id", user!.id);
    setSaving(false);
    if (error) toast.error("Couldn't save details");
    else toast.success("Details saved");
  };

  const handleSubmit = async () => {
    if (!row) return;
    if (!businessName.trim() || !legalName.trim()) {
      toast.error("Please add your business name and legal name first.");
      return;
    }
    if (!hasAllRequiredDocs(row)) {
      toast.error("Please upload all required documents.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("vendor_verifications")
      .update({
        status: "pending",
        business_name: businessName.trim(),
        legal_name: legalName.trim(),
        submitted_at: new Date().toISOString(),
        // Clear previous rejection state on resubmit so admins see a clean queue.
        rejection_note: null,
        rejection_reasons: [],
        info_request_note: null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't submit — try again.");
      return;
    }
    toast.success("Submitted for review");
    setRow({ ...row, status: "pending", submitted_at: new Date().toISOString() });
  };

  return (
    <DashboardLayout
      title="Get verified"
      subtitle="Add your KYC documents to display a Verified badge on your profile."
      actions={
        <Button variant="ghost" onClick={() => navigate("/provider-dashboard")}>
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
            <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-fs-xs font-semibold", meta.tone)}>
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
              <p className="text-fs-sm text-muted-foreground">
                Reviewed on {row?.reviewed_at ? new Date(row.reviewed_at).toLocaleDateString() : "—"}
                {expiresAt && (
                  <>
                    {" · "}
                    {isExpired ? (
                      <span className="text-destructive font-medium">
                        Expired on {new Date(expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <>Valid until {new Date(expiresAt).toLocaleDateString()}</>
                    )}
                  </>
                )}
              </p>
            )}
          </Card>

          {/* Renewal card (visible when approved & expired or expiring within 30 days) */}
          {canRenew && (
            <Card
              className={cn(
                "p-5 flex flex-col sm:flex-row sm:items-center gap-4",
                isExpired
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <RefreshCw
                className={cn(
                  "w-6 h-6 shrink-0",
                  isExpired ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                )}
              />
              <div className="flex-1">
                <p className="text-fs-sm font-semibold text-foreground">
                  {isExpired
                    ? "Your verification has expired"
                    : `Verification expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                </p>
                <p className="text-fs-xs text-muted-foreground">
                  Renew for ${RENEWAL_FEE} to extend your "Verified" badge by another year.
                </p>
              </div>
              <Button onClick={handleRenew} disabled={renewing} className="gap-1.5">
                {renewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Pay ${RENEWAL_FEE} & renew
              </Button>
            </Card>
          )}

          {/* Reviewer feedback (rejected or admin requested more info) */}
          {(status === "rejected" || status === "info_requested") && (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Heading level={3}  className="text-foreground mb-1">
                    {status === "info_requested" ? "Admin requested more information" : "Reviewer's notes"}
                  </Heading>
                  {status === "info_requested" && row?.info_request_note && (
                    <p className="text-fs-sm text-body mb-3 whitespace-pre-wrap">{row.info_request_note}</p>
                  )}
                  {row?.rejection_note && (
                    <p className="text-fs-sm text-body mb-3 whitespace-pre-wrap">{row.rejection_note}</p>
                  )}
                  {row?.rejection_reasons && row.rejection_reasons.length > 0 && (
                    <>
                      <p className="text-fs-xs font-semibold text-muted-foreground mb-2">Please fix:</p>
                      <ul className="space-y-1">
                        {row.rejection_reasons.map((r) => (
                          <li key={r} className="text-fs-sm text-body flex items-start gap-2">
                            <span className="text-destructive mt-0.5">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Business details */}
          <Card className="p-5 space-y-4">
            <Heading level={2}  className="text-foreground">Business details</Heading>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="business_name">Business name</Label>
                <Input
                  id="business_name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Plumbing Ltd."
                  disabled={!editable}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legal_name">Legal name</Label>
                <Input
                  id="legal_name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As shown on your ID"
                  disabled={!editable}
                  maxLength={120}
                />
              </div>
            </div>
            {editable && (
              <Button variant="outline" size="sm" onClick={handleSaveDetails} disabled={saving}>
                Save details
              </Button>
            )}
          </Card>

          {/* Documents */}
          <Card className="p-5 space-y-4">
            <Heading level={2}  className="text-foreground">Documents</Heading>
            <div className="space-y-3">
              {VERIFICATION_DOCS.map((doc) => {
                const path = (row as Record<string, unknown> | null)?.[doc.key] as string | null | undefined;
                const isUploading = uploading === doc.key;
                return (
                  <div
                    key={doc.key}
                    className="border border-border rounded-lg p-4 flex items-start gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-fs-sm font-medium text-foreground">{doc.label}</p>
                        {doc.required ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive/80">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Optional
                          </span>
                        )}
                        {path && <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <p className="text-fs-xs text-muted-foreground">{doc.description}</p>
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
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
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

          {editable && (
            <div className="flex items-center justify-end gap-2">
              <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === "rejected" ? "Resubmit for review" : "Submit for review"}
              </Button>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
