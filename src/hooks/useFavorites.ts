import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    const fetchFavorites = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("vendor_id")
        .eq("user_id", user.id);
      if (data) {
        setFavoriteIds(new Set(data.map((f) => f.vendor_id)));
      }
    };
    fetchFavorites();
  }, [user]);

  const toggleFavorite = useCallback(
    async (providerId: string) => {
      if (!user) {
        toast.error("Sign in to save providers");
        return;
      }
      const isFav = favoriteIds.has(providerId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(providerId);
        else next.add(providerId);
        return next;
      });

      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("vendor_id", providerId);
        if (error) {
          setFavoriteIds((prev) => new Set(prev).add(providerId));
          toast.error("Failed to remove from saved");
        }
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, vendor_id: providerId });
        if (error) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(providerId);
            return next;
          });
          toast.error("Failed to save provider");
        } else {
          toast.success("Provider saved!");
        }
      }
    },
    [user, favoriteIds]
  );

  const isFavorite = useCallback(
    (providerId: string) => favoriteIds.has(providerId),
    [favoriteIds]
  );

  return { favoriteIds, toggleFavorite, isFavorite, loading };
}
