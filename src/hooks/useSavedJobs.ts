import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useSavedJobs() {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("saved_jobs")
      .select("job_id")
      .eq("user_id", user.id);
    setSavedIds(new Set((data ?? []).map((r: { job_id: string }) => r.job_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleSaved = useCallback(
    async (jobId: string) => {
      if (!user) {
        toast.error("Sign in to save jobs");
        return;
      }
      const isSaved = savedIds.has(jobId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(jobId);
        else next.add(jobId);
        return next;
      });
      if (isSaved) {
        const { error } = await (supabase as any)
          .from("saved_jobs")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", jobId);
        if (error) {
          setSavedIds((prev) => new Set(prev).add(jobId));
          toast.error("Failed to remove");
        } else {
          toast.success("Removed from saved");
        }
      } else {
        const { error } = await (supabase as any)
          .from("saved_jobs")
          .insert({ user_id: user.id, job_id: jobId });
        if (error) {
          setSavedIds((prev) => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
          toast.error("Failed to save");
        } else {
          toast.success("Job saved");
        }
      }
    },
    [user, savedIds],
  );

  return { savedIds, toggleSaved, loading, refresh };
}
