import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Upload, X, Paperclip } from "lucide-react";

interface ReportIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId?: string;
  reportedUserId?: string;
  onSubmitted?: () => void;
  /** Pre-fill the form (e.g. when escalating from a non-refundable cancellation). */
  prefill?: {
    type?: string;
    subject?: string;
    description?: string;
  };
}

export default function ReportIssueModal({
  open, onOpenChange, bookingId, reportedUserId, onSubmitted, prefill,
}: ReportIssueModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState(prefill?.type || "service_quality");
  const [subject, setSubject] = useState(prefill?.subject || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Re-apply prefill whenever the modal opens with new context.
  useEffect(() => {
    if (open) {
      setType(prefill?.type || "service_quality");
      setSubject(prefill?.subject || "");
      setDescription(prefill?.description || "");
      setFiles([]);
    }
  }, [open, prefill?.type, prefill?.subject, prefill?.description]);

  const handleSubmit = async () => {
    if (!user) { toast.error("You must be logged in"); return; }
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setSaving(true);

    // Upload evidence files (if any) to chat-attachments bucket
    const evidence_urls: string[] = [];
    if (files.length) {
      setUploading(true);
      for (const file of files) {
        const path = `disputes/${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .upload(path, file, { upsert: false });
        if (upErr) {
          toast.error(`Failed to upload ${file.name}: ${upErr.message}`);
          setSaving(false); setUploading(false);
          return;
        }
        const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        evidence_urls.push(data.publicUrl);
      }
      setUploading(false);
    }

    const { error } = await supabase.from("disputes").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId || null,
      booking_id: bookingId || null,
      type,
      subject: subject.trim(),
      description: description.trim(),
      evidence_urls,
    });

    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Your report has been submitted. We'll review it shortly.");
    setSaving(false);
    setSubject("");
    setDescription("");
    setType("service_quality");
    setFiles([]);
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Report an Issue
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Issue Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="service_quality">Service Quality</SelectItem>
                <SelectItem value="payment">Payment Issue</SelectItem>
                <SelectItem value="behavior">Inappropriate Behavior</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Brief summary of the issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>Evidence (optional)</Label>
            <label
              htmlFor="dispute-evidence-input"
              className="flex items-center gap-2 cursor-pointer rounded-sm border border-dashed border-input px-3 py-2 text-fs-sm text-muted-foreground hover:bg-muted/40"
            >
              <Upload className="w-4 h-4" />
              Attach screenshots, PDFs, or other files
            </label>
            <input
              id="dispute-evidence-input"
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                const valid = list.filter((f) => f.size <= 10 * 1024 * 1024);
                if (valid.length !== list.length) toast.error("Some files exceed 10MB and were skipped");
                setFiles((prev) => [...prev, ...valid].slice(0, 5));
                e.target.value = "";
              }}
            />
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1 text-fs-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <Paperclip className="w-3 h-3 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {uploading ? "Uploading…" : saving ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
