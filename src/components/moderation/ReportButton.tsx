import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Flag } from "lucide-react";
import { toast } from "sonner";

type EntityType =
  | "review"
  | "message"
  | "task"
  | "profile"
  | "service"
  | "portfolio"
  | "verification";

interface Props {
  entityType: EntityType;
  entityId: string;
  size?: "sm" | "icon";
  className?: string;
}

const REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "Inappropriate or explicit",
  "Misleading or fake",
  "Personal info / privacy",
  "Other",
];

export default function ReportButton({ entityType, entityId, size = "sm", className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Please sign in to report"); return; }
    setSaving(true);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      details: details.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted. Thanks for the heads-up.");
    setOpen(false);
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={size} className={className} aria-label="Report">
          <Flag className="w-4 h-4" />
          {size !== "icon" && <span className="ml-1.5">Report</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-500" /> Report content
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Share any context that helps our team review."
              maxLength={1000}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}