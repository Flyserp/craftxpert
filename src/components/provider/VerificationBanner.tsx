import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, BadgeCheck, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/verification";

/**
 * Dashboard banner that nudges providers to complete verification.
 * - draft / no-row → primary CTA "Get verified"
 * - pending        → soft, informational
 * - rejected       → destructive tone, deep links to resubmit
 * - approved       → success ribbon (auto-hides after 7 days via createdAt? — kept always visible for now,
 *                    parent can choose to hide with a prop in future)
 */
export default function VerificationBanner({ className }: { className?: string }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [warnDays, setWarnDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data }, { data: setting }] = await Promise.all([
        supabase
          .from("vendor_verifications")
          .select("status, expires_at")
          .eq("vendor_id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "verification_warn_days")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setStatus((data?.status as VerificationStatus) ?? null);
      setExpiresAt((data as { expires_at?: string | null } | null)?.expires_at ?? null);
      const parsed = parseInt(String(setting?.value ?? "").replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) setWarnDays(parsed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);


  if (loading || !user) return null;

  // Approved: handle expiry (expired / expiring soon / active)
  if (status === "approved") {
    const expMs = expiresAt ? new Date(expiresAt).getTime() : null;
    const daysLeft = expMs ? Math.ceil((expMs - Date.now()) / 86_400_000) : null;
    const expired = expMs !== null && expMs <= Date.now();
    const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= warnDays;

    if (expired) {
      return (
        <div
          className={cn(
            "rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3",
            className,
          )}
        >
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-fs-sm font-semibold text-foreground">Your verification has expired</p>
            <p className="text-fs-xs text-muted-foreground">
              The "Verified" badge was removed from your profile. Renew to restore customer trust.
            </p>
          </div>
          <Button asChild size="sm" variant="destructive">
            <Link to="/provider-verification">Renew now</Link>
          </Button>
        </div>
      );
    }

    if (expiringSoon) {
      return (
        <div
          className={cn(
            "rounded-sm border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3",
            className,
          )}
        >
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-fs-sm font-semibold text-foreground">
              Verification expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}
            </p>
            <p className="text-fs-xs text-muted-foreground">
              Renew now to keep your "Verified" badge without interruption.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/provider-verification">Renew</Link>
          </Button>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3",
          className,
        )}
      >
        <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-fs-sm font-semibold text-foreground">You're verified</p>
          <p className="text-fs-xs text-muted-foreground">
            {expiresAt
              ? `Valid until ${new Date(expiresAt).toLocaleDateString()}.`
              : `A "Verified" badge is shown on your profile and listings.`}
          </p>
        </div>
      </div>
    );
  }

  // Pending review
  if (status === "pending") {
    return (
      <div
        className={cn(
          "rounded-sm border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-3",
          className,
        )}
      >
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-fs-sm font-semibold text-foreground">Verification under review</p>
          <p className="text-fs-xs text-muted-foreground">
            We'll notify you as soon as our team has reviewed your documents (usually within 1–2 business days).
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/provider-verification">View</Link>
        </Button>
      </div>
    );
  }

  // Rejected
  if (status === "rejected") {
    return (
      <div
        className={cn(
          "rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3",
          className,
        )}
      >
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-fs-sm font-semibold text-foreground">Your verification needs changes</p>
          <p className="text-fs-xs text-muted-foreground">
            Open the verification page to see the reviewer's notes and resubmit.
          </p>
        </div>
        <Button asChild size="sm" variant="destructive">
          <Link to="/provider-verification">Review & resubmit</Link>
        </Button>
      </div>
    );
  }

  // Draft / no row → primary CTA
  return (
    <div
      className={cn(
        "rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3",
        className,
      )}
    >
      <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-fs-sm font-semibold text-foreground">Get verified to earn customer trust</p>
        <p className="text-fs-xs text-muted-foreground">
          Add your ID and business documents to display a "Verified" badge on your profile.
        </p>
      </div>
      <Button asChild size="sm" className="gap-1.5 shrink-0">
        <Link to="/provider-verification">
          Get verified <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Button>
    </div>
  );
}
