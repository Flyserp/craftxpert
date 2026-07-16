import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  vendorId: string;
  /** Variant: 'icon' shows just a check icon (for cards), 'pill' shows label too (for profile). */
  variant?: "icon" | "pill";
  className?: string;
}

/**
 * Renders a "Verified" indicator only when the vendor has an approved
 * verification record. Reads from the public RLS-allowed select policy
 * (`status = 'approved'`), so no auth required and no PII is exposed.
 */
export default function VerificationBadge({
  vendorId,
  variant = "icon",
  className,
}: VerificationBadgeProps) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { count } = await supabase
        .from("vendor_verifications")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .eq("status", "approved")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
      if (!cancelled) setVerified((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!verified) return null;

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
          className,
        )}
      >
        <BadgeCheck className="w-3 h-3" />
        Verified
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex shrink-0", className)} aria-label="Verified provider">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">Identity & business verified</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
