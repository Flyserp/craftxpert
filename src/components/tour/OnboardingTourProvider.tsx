import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { ONBOARDING_TOURS, tourStorageKey } from "@/lib/onboardingTours";

type TourContextValue = {
  startTour: (role?: AppRole) => void;
  isActive: boolean;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useOnboardingTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useOnboardingTour must be used inside OnboardingTourProvider");
  return ctx;
}

function primaryRole(roles: AppRole[]): AppRole | null {
  if (!roles.length) return null;
  const priority: AppRole[] = ["admin", "provider", "employer", "customer"];
  return priority.find((r) => roles.includes(r)) ?? roles[0];
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { user, roles, loading } = useAuth();
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback(
    (role?: AppRole) => {
      const target = role ?? primaryRole(roles);
      if (!target) return;
      setActiveRole(target);
      setStepIndex(0);
    },
    [roles],
  );

  // Auto-start once per role
  useEffect(() => {
    if (loading || !user) return;
    const role = primaryRole(roles);
    if (!role) return;
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(tourStorageKey(role));
      if (!seen) {
        // Delay so the dashboard has a chance to render first
        const t = window.setTimeout(() => startTour(role), 1200);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [loading, user, roles, startTour]);

  const steps = activeRole ? ONBOARDING_TOURS[activeRole] : [];
  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const finish = useCallback(() => {
    if (activeRole) {
      try {
        window.localStorage.setItem(tourStorageKey(activeRole), String(Date.now()));
      } catch {
        /* ignore */
      }
    }
    setActiveRole(null);
    setStepIndex(0);
  }, [activeRole]);

  const value = useMemo<TourContextValue>(
    () => ({ startTour, isActive: !!activeRole }),
    [startTour, activeRole],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      <Dialog open={!!activeRole} onOpenChange={(open) => { if (!open) finish(); }}>
        <DialogContent className="max-w-md">
          {step && (
            <>
              <DialogHeader>
                <div className="text-eyebrow text-accent mb-2">
                  Step {stepIndex + 1} of {steps.length}
                </div>
                <DialogTitle>{step.title}</DialogTitle>
                <DialogDescription className="pt-2 leading-relaxed">
                  {step.body}
                </DialogDescription>
              </DialogHeader>

              {step.ctaHref && step.ctaLabel && (
                <div className="pt-2">
                  <Button asChild variant="secondary" size="sm" className="rounded-sm">
                    <Link to={step.ctaHref} onClick={finish}>{step.ctaLabel} →</Link>
                  </Button>
                </div>
              )}

              <DialogFooter className="mt-4 flex flex-row items-center justify-between sm:justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={finish} className="rounded-sm">
                  Skip tour
                </Button>
                <div className="flex items-center gap-2">
                  {stepIndex > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                      className="rounded-sm"
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
                    className="rounded-sm"
                  >
                    {isLast ? "Finish" : "Next"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TourContext.Provider>
  );
}