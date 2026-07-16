import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useOnboardingTour } from "@/components/tour/OnboardingTourProvider";
import { tourStorageKey } from "@/lib/onboardingTours";
import { Sparkles } from "lucide-react";

export default function RestartTourSection({ role }: { role?: AppRole }) {
  const { roles } = useAuth();
  const { startTour } = useOnboardingTour();
  const target: AppRole | undefined =
    role ??
    (["admin", "moderator", "provider", "employer", "customer"] as AppRole[]).find((r) => roles.includes(r));

  const handleRestart = () => {
    if (target) {
      try {
        window.localStorage.removeItem(tourStorageKey(target));
      } catch {
        /* ignore */
      }
    }
    startTour(target);
  };

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Product tour
        </CardTitle>
        <CardDescription>
          Replay the guided walkthrough of dashboard features, sponsorship, verification, and subscription workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleRestart} variant="secondary" size="sm" className="rounded-sm">
          Restart tour
        </Button>
      </CardContent>
    </Card>
  );
}