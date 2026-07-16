import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Heading } from "@/components/ui/app";

const CONFIRM_PHRASE = "DELETE";

export default function DeleteAccountSection() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      toast.error(`Please type ${CONFIRM_PHRASE} to confirm.`);
      return;
    }
    setSubmitting(true);
    try {
      // 1. Soft-delete profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          deleted_at: new Date().toISOString(),
          display_name: "Deleted user",
          phone: null,
          address: null,
          bio: null,
        })
        .eq("user_id", user.id);
      if (profErr) throw profErr;

      // 2. Audit log entry
      await supabase.from("admin_audit_log").insert({
        actor_id: user.id,
        target_user_id: user.id,
        action: "account.self_deleted",
        entity_type: "profile",
        entity_id: user.id,
        details: {
          email: user.email,
          display_name: profile?.display_name ?? null,
          reason: reason.trim() || null,
        },
      });

      toast.success("Your account has been deleted.");
      setOpen(false);
      await signOut();
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-card border border-destructive/30 rounded-sm p-6 animate-reveal-delay-3 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <Heading level={2} >Danger zone</Heading>
        </div>
        <p className="text-fs-xs text-muted-foreground">
          Permanently delete your account and personal data. Booking history and
          payment records may be retained for legal and accounting purposes.
        </p>
        <Button
          variant="outline"
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="w-4 h-4" /> Delete account
        </Button>
      </section>

      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirmText(""); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete your account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate your profile and sign you out. You won't be able
              to log back in. Booking and payment records are kept for compliance.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-fs-xs">Why are you leaving? (optional)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Helps us improve"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-fs-xs">
                Type <span className="font-mono font-semibold text-destructive">{CONFIRM_PHRASE}</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={submitting || confirmText.trim() !== CONFIRM_PHRASE}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
