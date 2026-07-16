import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Loader2,
  UserRound,
  BellRing,
  ClipboardList,
  X,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

type Step = {
  key: "profile" | "preferences" | "first_assignment";
  title: string;
  description: string;
  icon: typeof UserRound;
  cta: { label: string; href: string };
  done: boolean;
};

const STORAGE_KEY = "staff_onboarding_dismissed";

interface Props {
  userId: string;
  /** Pass the staff member's current bookings count to avoid a duplicate query. */
  hasAssignedBooking: boolean;
  className?: string;
}

export default function StaffOnboardingChecklist({
  userId,
  hasAssignedBooking,
  className,
}: Props) {
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [hasPrefs, setHasPrefs] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Per-user dismissal so a fresh staff member always sees the checklist once.
  const dismissKey = `${STORAGE_KEY}:${userId}`;

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey) === "1") {
      setDismissed(true);
    }
  }, [dismissKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { count: prefCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("profile_completed, display_name, phone, avatar_url")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("notification_preferences")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
      if (cancelled) return;
      // Treat profile as "complete" if the explicit flag is set OR the basics are filled.
      const explicitlyComplete = profile?.profile_completed === true;
      const hasBasics = !!profile?.display_name && !!profile?.phone;
      setProfileComplete(explicitlyComplete || hasBasics);
      setHasPrefs((prefCount ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const steps: Step[] = useMemo(
    () => [
      {
        key: "profile",
        title: "Complete your profile",
        description: "Add your name, photo and phone so customers know who's coming.",
        icon: UserRound,
        cta: { label: "Edit profile", href: "/client/profile" },
        done: profileComplete === true,
      },
      {
        key: "preferences",
        title: "Set notification preferences",
        description: "Choose how you want to hear about new assignments.",
        icon: BellRing,
        cta: { label: "Open preferences", href: "/client/settings" },
        done: hasPrefs === true,
      },
      {
        key: "first_assignment",
        title: "Receive your first assignment",
        description: "Your provider will assign you to a booking — it'll appear here.",
        icon: ClipboardList,
        cta: { label: "View assignments", href: "/staff-dashboard" },
        done: hasAssignedBooking,
      },
    ],
    [profileComplete, hasPrefs, hasAssignedBooking],
  );

  const ready = profileComplete !== null && hasPrefs !== null;
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const percent = Math.round((completedCount / steps.length) * 100);

  // Auto-dismiss when everything is done so the panel stops occupying space.
  useEffect(() => {
    if (ready && allDone && !dismissed) {
      localStorage.setItem(dismissKey, "1");
    }
  }, [ready, allDone, dismissed, dismissKey]);

  if (dismissed) return null;
  if (ready && allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "rounded-sm border border-border bg-card p-5 sm:p-6 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <Heading level={2} >
              Get set up as staff
            </Heading>
            <p className="text-description-sm mt-1">
              Three quick steps so your provider can start assigning you work.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between text-fs-xs mb-2">
          <span className="text-muted-foreground">
            {ready
              ? `${completedCount} of ${steps.length} complete`
              : "Checking your setup…"}
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {ready ? `${percent}%` : ""}
          </span>
        </div>
        <Progress value={ready ? percent : 0} className="h-2" />
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const loading = !ready;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-3 rounded-sm border p-3 sm:p-4 transition-colors",
                step.done
                  ? "border-primary/20 bg-primary/[0.04]"
                  : "border-border bg-background",
              )}
            >
              <div className="shrink-0 mt-0.5">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={cn(
                      "text-fs-sm font-medium",
                      step.done && "text-muted-foreground line-through",
                    )}
                  >
                    {i + 1}. {step.title}
                  </span>
                </div>
                <p className="text-description-sm mt-1">{step.description}</p>
              </div>
              {!step.done && step.key !== "first_assignment" && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="shrink-0 self-center"
                >
                  <Link to={step.cta.href}>{step.cta.label}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
