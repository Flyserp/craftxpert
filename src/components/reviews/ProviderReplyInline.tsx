import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProviderReplyInlineProps {
  bookingId: string;
  onReplied?: () => void;
}

export default function ProviderReplyInline({ bookingId, onReplied }: ProviderReplyInlineProps) {
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const trimmed = reply.trim();
    if (!trimmed || trimmed.length > 1000) return;
    setSubmitting(true);
    try {
      // Find the review for this booking
      const { data: review, error: findErr } = await supabase
        .from("reviews")
        .select("id, customer_id, vendor_id")
        .eq("booking_id", bookingId)
        .single();

      if (findErr || !review) {
        toast.error("Review not found for this booking.");
        return;
      }

      const { error } = await supabase
        .from("reviews")
        .update({
          vendor_reply: trimmed,
          vendor_reply_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      if (error) {
        toast.error("Failed to submit reply.");
        return;
      }

      // Notify the customer (fire-and-forget)
      const { data: vendorProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", review.vendor_id)
        .single();

      supabase.from("notifications").insert({
        user_id: review.customer_id,
        type: "info",
        title: "Provider replied to your review",
        message: `${vendorProfile?.display_name || "The provider"} responded: "${trimmed.slice(0, 100)}${trimmed.length > 100 ? "…" : ""}"`,
        metadata: { booking_id: bookingId },
      }).then(({ error: nErr }) => {
        if (nErr) console.error("Reply notification error:", nErr);
      });

      setSubmitted(true);
      toast.success("Reply posted!");
      onReplied?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 text-fs-xs text-primary">
        <Check className="w-3 h-3" /> Replied
      </span>
    );
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-fs-xs px-2.5 gap-1.5"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Reply
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <Textarea
        placeholder="Write your reply..."
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
        maxLength={1000}
        className="text-fs-sm"
        autoFocus
      />
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-fs-xs"
          onClick={() => { setExpanded(false); setReply(""); }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-fs-xs gap-1"
          disabled={!reply.trim() || submitting}
          onClick={handleSubmit}
        >
          <Send className="w-3 h-3" />
          {submitting ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </div>
  );
}
