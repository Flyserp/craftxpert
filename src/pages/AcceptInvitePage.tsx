import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, CheckCircle2, ShieldAlert, Users, MailCheck, RefreshCw, AlertTriangle, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AuthLayout from "@/components/auth/AuthLayout";

type InviteRole = "staff" | "manager" | "provider_admin";

interface InviteInfo {
  id: string;
  provider_id: string;
  provider_name: string | null;
  email: string;
  title: string | null;
  role: InviteRole;
  status: string;
  expires_at: string;
}

const ROLE_LABEL: Record<InviteRole, string> = {
  staff: "Staff member",
  manager: "Manager",
  provider_admin: "Team admin",
};

const ROLE_DESTINATION: Record<InviteRole, { label: string; href: string }> = {
  staff: { label: "Go to staff dashboard", href: "/staff-dashboard" },
  manager: { label: "Manage your team", href: "/provider/staff" },
  provider_admin: { label: "Open provider dashboard", href: "/provider-dashboard" },
};

type ResendStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; email: string }
  | { state: "error"; message: string };

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState<ResendStatus>({ state: "idle" });
  const [navError, setNavError] = useState<string | null>(null);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const REDIRECT_SECONDS = 5;
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  // Known destination routes. Keep in sync with src/App.tsx routing — if a role
  // points at a path missing from this list (e.g. after a code refactor),
  // safeNavigate aborts and surfaces an in-page error instead of stranding the
  // user on a blank screen.
  const KNOWN_ROUTES: ReadonlySet<string> = new Set([
    "/staff-dashboard",
    "/provider/staff",
    "/provider-staff",
    "/provider-dashboard",
  ]);

  const safeNavigate = (href: string) => {
    setNavError(null);
    if (!KNOWN_ROUTES.has(href)) {
      const msg = `The destination "${href}" isn't available in this app version.`;
      setNavError(msg);
      setAutoCancelled(true);
      toast.error(msg);
      void logAnalytics("staff_invite.redirect_failed", {
        reason: "unknown_route",
        destination: href,
      });
      return;
    }
    try {
      navigate(href);
      void logAnalytics("staff_invite.redirect_completed", { destination: href });
    } catch (e) {
      const msg =
        e instanceof Error
          ? `Couldn't open ${href}: ${e.message}`
          : `Couldn't open ${href}.`;
      setNavError(msg);
      setAutoCancelled(true);
      toast.error(msg);
      void logAnalytics("staff_invite.redirect_failed", {
        reason: "navigate_threw",
        destination: href,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Lightweight analytics: piggy-back on admin_audit_log so invite funnel
  // events live next to the existing staff_invite.* records and can be
  // queried without a new table. Best-effort — failures are swallowed so
  // analytics never block the user flow.
  const logAnalytics = async (
    action:
      | "staff_invite.accept_completed"
      | "staff_invite.redirect_completed"
      | "staff_invite.redirect_failed"
      | "staff_invite.unknown_role",
    extra: Record<string, unknown> = {},
  ) => {
    if (!info) return;
    try {
      await supabase.from("admin_audit_log").insert({
        actor_id: user?.id ?? null,
        target_user_id: info.provider_id,
        action,
        entity_type: "staff_invitation",
        entity_id: info.id,
        details: {
          invitation_id: info.id,
          provider_id: info.provider_id,
          provider_name: info.provider_name,
          role: info.role,
          email: info.email,
          source: "accept_invite_page",
          occurred_at: new Date().toISOString(),
          ...extra,
        },
      });
    } catch {
      /* analytics failures must not affect UX */
    }
  };

  // Basic client-side token shape check — staff_invitations.token is a non-empty
  // opaque string. Reject anything obviously malformed before hitting the RPC so
  // we don't waste a round-trip and we show a clear error immediately.
  const tokenLooksValid =
    typeof token === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(token);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      setLoading(false);
      return;
    }
    if (!tokenLooksValid) {
      setError("This invitation link is malformed. Please check the URL and try again.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_staff_invitation", {
        _token: token,
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data || data.length === 0) {
        setError("This invitation could not be found. It may have been revoked, or the link may be incorrect.");
      } else {
        setInfo(data[0] as InviteInfo);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tokenLooksValid]);

  const expired = info && new Date(info.expires_at) < new Date();
  const stale = info && info.status !== "pending";
  // Defensive: if the server returns a role we don't recognize (older client,
  // schema drift, or tampered data), block acceptance and surface guidance
  // instead of silently routing the user to the wrong dashboard.
  const unknownRole = !!info && !(info.role in ROLE_DESTINATION);

  // Track schema-drift events so admins can spot client/server role mismatches
  // (e.g. server adds a new role before the app is updated). Fire-once per load.
  useEffect(() => {
    if (!info || !unknownRole) return;
    void logAnalytics("staff_invite.unknown_role", {
      received_role: info.role,
      supported_roles: Object.keys(ROLE_DESTINATION),
      app_version: typeof window !== "undefined" ? window.location.host : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.id, unknownRole]);

  const handleAccept = async () => {
    // Hard guards against double-submit: if the user double-clicks, taps
    // Enter twice, or the network is slow, we must not call accept_staff_invitation
    // a second time before the first response lands or after success.
    if (accepting || accepted) return;
    // Refuse to submit when the invite is missing, has no role, or has a role
    // this client can't route. Submitting would either fail server-side or
    // grant access we can't safely send the user to.
    if (!info || !info.role || !(info.role in ROLE_DESTINATION)) {
      const msg = "This invitation has an unknown or missing role and can't be accepted. Please request a corrected invite.";
      toast.error(msg);
      setError(msg);
      return;
    }
    if (!user) {
      navigate(`/login?redirect=/accept-invite/${token}`);
      return;
    }
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_staff_invitation", {
      _token: token!,
    });
    setAccepting(false);
    if (error) {
      toast.error(error.message);
      setError(error.message);
      return;
    }
    const result = data as { error?: string; success?: boolean } | null;
    if (result?.error) {
      toast.error(result.error);
      if (/expired/i.test(result.error)) {
        setInfo((prev) =>
          prev ? { ...prev, status: "expired", expires_at: new Date(0).toISOString() } : prev,
        );
      } else if (/no longer pending/i.test(result.error)) {
        setInfo((prev) => (prev ? { ...prev, status: "revoked" } : prev));
      } else {
        setError(result.error);
      }
      return;
    }
    setAccepted(true);
    toast.success("You've joined the team!");
    const role: InviteRole = info && info.role in ROLE_DESTINATION ? info.role : "staff";
    void logAnalytics("staff_invite.accept_completed", {
      destination: ROLE_DESTINATION[role].href,
      destination_label: ROLE_DESTINATION[role].label,
      auto_redirect_seconds: REDIRECT_SECONDS,
    });
  };

  // Auto-redirect to the role-specific destination after acceptance, with a
  // visible countdown so the user knows what's coming. The "Go now" button
  // lets them skip the wait at any time. Cancelled if a previous navigation
  // attempt failed (autoCancelled), so the user isn't trapped in a retry loop.
  useEffect(() => {
    if (!accepted || autoCancelled) return;
    const role: InviteRole = info && info.role in ROLE_DESTINATION ? info.role : "staff";
    const href = ROLE_DESTINATION[role].href;
    setCountdown(REDIRECT_SECONDS);
    const tick = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(tick);
          safeNavigate(href);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, info, autoCancelled]);

  const handleResend = async () => {
    if (!token || !tokenLooksValid) return;
    // Don't request a new invite once the current one has been accepted —
    // it would invalidate the user's just-granted access.
    if (accepted) return;
    if (resend.state === "sending" || resend.state === "sent") return;
    setResend({ state: "sending" });
    const { data, error } = await supabase.functions.invoke("resend-staff-invitation", {
      body: { token },
    });
    if (error) {
      const msg = error.message || "Couldn't request a new invite. Please try again.";
      setResend({ state: "error", message: msg });
      toast.error(msg);
      return;
    }
    const result = data as { error?: string; email?: string } | null;
    if (result?.error) {
      setResend({ state: "error", message: result.error });
      toast.error(result.error);
      return;
    }
    setResend({ state: "sent", email: result?.email ?? info?.email ?? "" });
    toast.success("New invitation requested. The provider has been notified.");
  };

  const isLoading = loading || authLoading;
  const blocked = !isLoading && !error && (expired || stale);
  const canResend = !isLoading && tokenLooksValid && (blocked || unknownRole || (error && info));

  const eyebrow = "Staff invitation";
  const title = isLoading
    ? "Loading invitation…"
    : error
      ? "Invitation problem"
      : accepted
        ? "You're in!"
        : unknownRole
          ? "Unsupported invite role"
          : blocked
            ? "Invitation unavailable"
            : `Join ${info?.provider_name || "the team"}`;
  const inviteRole: InviteRole = info && !unknownRole ? info.role : "staff";
  const destination = ROLE_DESTINATION[inviteRole];
  const roleLabel = ROLE_LABEL[inviteRole];

  const subtitle = isLoading
    ? undefined
    : error
      ? error
      : accepted
        ? `You've joined ${info?.provider_name || "the team"} as ${roleLabel.toLowerCase()}.`
        : unknownRole
          ? `This invite is for a role ("${info?.role}") this app version doesn't recognize. Ask ${info?.provider_name || "the provider"} to send a fresh invitation, or refresh the page after updating.`
          : blocked
            ? expired
              ? "This invitation has expired."
              : `This invitation has already been ${info?.status}.`
            : `You've been invited as ${info?.title || roleLabel.toLowerCase()}. Once you accept, you'll get access to your ${roleLabel.toLowerCase()} workspace.`;

  return (
    <AuthLayout eyebrow={eyebrow} title={title} subtitle={subtitle} panelVariant="invite">
      <div className="flex justify-center mb-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : error || blocked || unknownRole ? (
            <ShieldAlert className="h-6 w-6 text-destructive" />
          ) : accepted ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <Users className="h-6 w-6" />
          )}
        </span>
      </div>

      {isLoading ? null : accepted ? (
        <div className="space-y-3">
          {navError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Couldn't open your dashboard</AlertTitle>
              <AlertDescription>
                {navError} You're still signed in to the team — try again, or
                contact {info?.provider_name || "your provider"} for help.
              </AlertDescription>
            </Alert>
          )}
          <Button className="w-full" onClick={() => safeNavigate(destination.href)}>
            {navError ? "Try again" : `Go now — ${destination.label}`}
          </Button>
          {navError ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go home instead
            </Button>
          ) : (
            <p
              className="text-fs-xs text-muted-foreground text-center tabular-nums"
              role="status"
              aria-live="polite"
            >
              {autoCancelled
                ? "Auto-redirect cancelled."
                : countdown > 0
                  ? `Redirecting in ${countdown}…`
                  : "Redirecting now…"}
            </p>
          )}
        </div>
      ) : error || blocked || unknownRole ? (
        <div className="space-y-3">
          {unknownRole && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-3">
                <p className="text-fs-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Supported roles
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Supported invite roles">
                  {Object.values(ROLE_LABEL).map((label) => (
                    <li
                      key={label}
                      className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-fs-sm font-semibold text-heading mb-2">
                What to do next
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-fs-xs text-muted-foreground marker:text-foreground/70 marker:font-semibold">
                <li>
                  Ask <strong className="text-foreground">{info?.provider_name || "the provider"}</strong>{" "}
                  to resend the invite with one of the supported roles:{" "}
                  <span className="text-foreground">
                    {Object.values(ROLE_LABEL).join(", ")}
                  </span>
                  .
                </li>
                <li>
                  Quote your invite ID{" "}
                  <code className="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[11px]">
                    {info?.id ? info.id.slice(0, 8) : "unknown"}
                  </code>{" "}
                  so they can find and revoke this one.
                </li>
                <li>
                  Once they confirm, hard-refresh this page to load the latest
                  app version, then open the new invite link from your email.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center gap-1.5 text-fs-xs font-semibold text-primary hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh this page now
              </button>
            </div>
          )}
          {canResend ? (
            <>
              <Button
                className="w-full"
                onClick={handleResend}
                disabled={resend.state === "sending" || resend.state === "sent"}
              >
                {resend.state === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting new invite…
                  </>
                ) : resend.state === "sent" ? (
                  <>
                    <MailCheck className="mr-2 h-4 w-4" />
                    New invite requested
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Request a new invite
                  </>
                )}
              </Button>
              {resend.state === "sent" && (
                <div className="rounded-sm border border-primary/20 bg-primary/5 p-3 text-fs-xs text-foreground">
                  <p className="font-medium flex items-center gap-1.5">
                    <MailCheck className="h-3.5 w-3.5 text-primary" />
                    Notification sent
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    We've notified the provider to send a fresh link to{" "}
                    <strong className="text-foreground">{resend.state === "sent" ? resend.email : ""}</strong>.
                    Check your email shortly.
                  </p>
                </div>
              )}
              {resend.state === "error" && (
                <p className="text-fs-xs text-destructive text-center">{resend.message}</p>
              )}
            </>
          ) : null}
          {unknownRole && (() => {
            const inviteIdShort = info?.id ? info.id.slice(0, 8) : "unknown";
            const providerLabel = info?.provider_name || "(provider name unavailable)";
            const subject = `Unsupported invite role — invite ${inviteIdShort}`;
            const bodyLines = [
              "Hi support team,",
              "",
              "I tried to accept a staff invitation but the role isn't recognized by the app.",
              "",
              `• Invite ID: ${info?.id ?? "unknown"}`,
              `• Provider: ${providerLabel}`,
              `• Role on invite: ${info?.role ?? "unknown"}`,
              `• My email: ${info?.email ?? "unknown"}`,
              "",
              "Please send me a corrected invitation. Thanks!",
            ];
            const mailto = `mailto:support@taskhive.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
            return (
              <a
                href={mailto}
                className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-background px-4 py-2 text-fs-sm font-medium text-foreground hover:bg-hover hover:text-hover-foreground transition-colors"
              >
                <LifeBuoy className="h-4 w-4" />
                Contact support
              </a>
            );
          })()}
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            Go home
          </Button>
        </div>
      ) : !user ? (
        <div className="space-y-2">
          <p className="text-fs-xs text-muted-foreground text-center mb-2">
            Sign in or create an account using{" "}
            <strong className="text-foreground">{info?.email}</strong> to accept.
          </p>
          <Button
            className="w-full"
            onClick={() => navigate(`/login?redirect=/accept-invite/${token}`)}
          >
            Sign in to accept
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/signup?redirect=/accept-invite/${token}`)}
          >
            Create an account
          </Button>
        </div>
      ) : (
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={handleAccept}
          disabled={accepting || accepted || unknownRole || !info?.role}
          aria-busy={accepting || undefined}
        >
          {(accepting || accepted) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {accepted ? "Accepted — redirecting…" : "Accept invitation"}
        </Button>
      )}
    </AuthLayout>
  );
}
