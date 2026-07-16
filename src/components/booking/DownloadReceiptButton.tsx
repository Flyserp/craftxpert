import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props extends Omit<ButtonProps, "onClick" | "children"> {
  bookingId: string;
  /** Visual label override. Defaults to "Receipt". */
  label?: string;
  /** Render as icon-only (no label text). */
  iconOnly?: boolean;
}

/**
 * Calls the `generate-booking-receipt` edge function and opens the resulting
 * signed PDF URL in a new tab. Authorization is enforced server-side
 * (customer, assigned vendor, or admin only).
 */
export default function DownloadReceiptButton({
  bookingId,
  label = "Receipt",
  iconOnly = false,
  className,
  variant = "outline",
  size = "sm",
  ...rest
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        url?: string;
        error?: string;
      }>("generate-booking-receipt", {
        body: { bookingId },
      });
      if (error || !data?.url) {
        toast.error(data?.error || error?.message || "Could not generate receipt");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={handleClick}
      disabled={loading}
      aria-label={`Download receipt for booking ${bookingId.slice(0, 8)}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}
