import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";

type Extras = {
  employerPayload?: Record<string, unknown>;
  providerPlan?: "free" | "pro" | "elite";
};

const dashboardForRole = (role: AppRole): string => {
  switch (role) {
    case "admin":
      return "/admin";
    case "moderator":
      return "/admin/moderation-inbox";
    case "provider":
      return "/provider-dashboard";
    case "employer":
      return "/employer-dashboard";
    default:
      return "/client-dashboard";
  }
};

/**
 * Persist the tail-end of an onboarding flow: writes the shared profile
 * payload, flips `profile_completed`, upserts role-specific rows, and
 * routes the user to their dashboard. Each role calls this from its own
 * "Finish" step so the plumbing is identical everywhere.
 */
export function useFinishOnboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  return useCallback(
    async (
      role: AppRole,
      profilePayload: Record<string, unknown>,
      extras: Extras = {},
    ) => {
      if (!user) throw new Error("Not signed in");

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ ...profilePayload, profile_completed: true } as any)
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      if (role === "employer" && extras.employerPayload) {
        const { error: empErr } = await supabase
          .from("employer_profiles")
          .upsert(
            { user_id: user.id, ...extras.employerPayload },
            { onConflict: "user_id" },
          );
        if (empErr) throw empErr;
      }

      if (role === "provider" && extras.providerPlan) {
        const { error: planErr } = await supabase
          .from("provider_settings")
          .upsert(
            { user_id: user.id, plan: extras.providerPlan },
            { onConflict: "user_id" },
          );
        if (planErr) throw planErr;
      }

      await refreshProfile();
      toast.success("You're all set. Welcome aboard!");
      navigate(dashboardForRole(role), { replace: true });
    },
    [user, refreshProfile, navigate],
  );
}
