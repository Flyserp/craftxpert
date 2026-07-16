import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useProviderSubscription } from "@/hooks/useProviderSubscription";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sticky-style alert shown to providers when their subscription is missing,
 * cancelled, or expired. Hidden on the subscription page itself.
 */
const SubscriptionRenewalBanner = () => {
  const { hasRole } = useAuth();
  const { subscription, isActive, loading } = useProviderSubscription();
  const location = useLocation();

  if (!hasRole("provider")) return null;
  if (loading || isActive) return null;
  if (location.pathname.startsWith("/provider-subscription")) return null;

  const expired = subscription && subscription.status === "expired";
  const cancelled = subscription && subscription.status === "cancelled";

  const title = expired
    ? "Your subscription has expired"
    : cancelled
      ? "Your subscription was cancelled"
      : "Subscribe to unlock the marketplace";

  const body = expired
    ? "Renew now to keep applying to jobs and appearing in search results."
    : cancelled
      ? "Reactivate to keep applying to jobs and appearing in search results."
      : "Providers without an active plan can't apply to jobs and are hidden from search.";

  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-fs-sm font-semibold text-heading">{title}</p>
          <p className="text-fs-xs text-muted-foreground">{body}</p>
        </div>
      </div>
      <Link
        to="/provider-subscription"
        className="inline-flex items-center gap-1 self-start sm:self-auto rounded-sm bg-primary text-primary-foreground text-fs-sm font-semibold px-3 h-9"
      >
        Renew now <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};

export default SubscriptionRenewalBanner;