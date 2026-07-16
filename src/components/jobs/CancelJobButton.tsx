import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CancelJobButtonProps {
  taskId: string;
  role: "customer" | "provider";
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "destructive" | "ghost" | "default";
  className?: string;
  label?: string;
  onCancelled?: () => void;
}

export default function CancelJobButton({
  taskId,
  role,
  disabled,
  size = "sm",
  variant = "outline",
  className,
  label,
  onCancelled,
}: CancelJobButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const buttonLabel =
    label ?? (role === "customer" ? "Cancel job" : "Cancel accepted job");

  const dialogCopy =
    role === "customer"
      ? {
          title: "Cancel this job?",
          description:
            "This will close the job, withdraw any pending or accepted proposals, and notify the assigned provider. This cannot be undone.",
        }
      : {
          title: "Cancel your accepted job?",
          description:
            "You'll be withdrawn from this job and it will return to the open marketplace. The customer will be notified.",
        };

  const handleConfirm = async () => {
    setBusy(true);
    // rpc: cancel_job(_task_id uuid, _reason text)
    const { error } = await (supabase.rpc as any)("cancel_job", {
      _task_id: taskId,
      _reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not cancel this job");
      return;
    }
    toast.success(
      role === "customer" ? "Job cancelled" : "You withdrew from this job",
    );
    setOpen(false);
    setReason("");
    onCancelled?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled}
          className={className}
        >
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          {buttonLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogCopy.title}</AlertDialogTitle>
          <AlertDialogDescription>{dialogCopy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-fs-sm">
            Reason (optional)
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="Share a short reason so the other party knows what happened…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep job</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Confirm cancellation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
