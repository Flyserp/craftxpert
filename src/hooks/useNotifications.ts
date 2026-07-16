import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

type PrefKey =
  | "booking_updates"
  | "new_messages"
  | "payment_updates"
  | "review_alerts"
  | "marketing";

type EffectivePrefs = {
  push_enabled: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  payment_updates: boolean;
  review_alerts: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: EffectivePrefs = {
  push_enabled: true,
  booking_updates: true,
  new_messages: true,
  payment_updates: true,
  review_alerts: true,
  marketing: false,
};

/**
 * Map a notification's event/type to one of the user-configurable push
 * categories. Kept in sync with the mapping in `supabase/functions/send-push`
 * so in-app filtering matches what the user sees on their device.
 */
export function mapNotificationToCategory(n: {
  type?: string | null;
  metadata?: Record<string, any> | null;
}): PrefKey | null {
  const raw = (n.metadata?.event as string | undefined) ?? n.type ?? "";
  const e = raw.toLowerCase();
  if (!e) return null;
  if (
    e.startsWith("booking") ||
    e.startsWith("reschedule") ||
    e.includes("booking") ||
    e === "provider_on_the_way" ||
    e === "staff_assigned" ||
    e === "staff_unassigned"
  )
    return "booking_updates";
  if (e.startsWith("message") || e.includes("chat") || e.includes("message"))
    return "new_messages";
  if (
    e.startsWith("payment") ||
    e.startsWith("payout") ||
    e.startsWith("withdrawal") ||
    e.startsWith("invoice") ||
    e.startsWith("refund")
  )
    return "payment_updates";
  if (e.startsWith("review") || e.includes("rating")) return "review_alerts";
  if (
    e.startsWith("marketing") ||
    e.startsWith("announcement") ||
    e.startsWith("promo") ||
    e === "promotion"
  )
    return "marketing";
  return null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState<EffectivePrefs>(DEFAULT_PREFS);
  const prefsRef = useRef<EffectivePrefs>(DEFAULT_PREFS);
  const channelInstanceId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );

  /**
   * A notification passes the filter when its category is enabled — or when
   * we can't classify it (system alerts, etc.), so nothing critical is lost.
   * Master `push_enabled=false` still lets in-app notifications through; that
   * toggle is device-only. Category toggles apply to both channels.
   */
  const shouldShow = useCallback((n: Notification, p: EffectivePrefs) => {
    const cat = mapNotificationToCategory(n);
    if (!cat) return true;
    return p[cat] !== false;
  }, []);

  const recomputeUnread = useCallback((list: Notification[]) => {
    setUnreadCount(list.filter((n) => !n.is_read).length);
  }, []);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const [{ data: userPrefs }, { data: tenantDefaults }] = await Promise.all([
      supabase
        .from("provider_push_settings")
        .select(
          "push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing, overrides_defaults"
        )
        .eq("provider_id", user.id)
        .maybeSingle(),
      supabase
        .from("tenant_push_defaults")
        .select(
          "push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing"
        )
        .eq("id", true)
        .maybeSingle(),
    ]);

    const source =
      userPrefs && (userPrefs as any).overrides_defaults
        ? userPrefs
        : tenantDefaults ?? userPrefs;

    const next: EffectivePrefs = {
      push_enabled: source?.push_enabled ?? DEFAULT_PREFS.push_enabled,
      booking_updates: source?.booking_updates ?? DEFAULT_PREFS.booking_updates,
      new_messages: source?.new_messages ?? DEFAULT_PREFS.new_messages,
      payment_updates: source?.payment_updates ?? DEFAULT_PREFS.payment_updates,
      review_alerts: source?.review_alerts ?? DEFAULT_PREFS.review_alerts,
      marketing: source?.marketing ?? DEFAULT_PREFS.marketing,
    };
    prefsRef.current = next;
    setPrefs(next);
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const filtered = (data as unknown as Notification[]).filter((n) =>
        shouldShow(n, prefsRef.current)
      );
      setNotifications(filtered.slice(0, 20));
      recomputeUnread(filtered.slice(0, 20));
    }
  }, [user, shouldShow, recomputeUnread]);

  // Load prefs first, then notifications, so filtering uses the correct values.
  useEffect(() => {
    (async () => {
      await loadPrefs();
      await fetchNotifications();
    })();
  }, [loadPrefs, fetchNotifications]);

  // Re-filter locally when prefs change (no refetch required).
  useEffect(() => {
    setNotifications((prev) => {
      const next = prev.filter((n) => shouldShow(n, prefs));
      recomputeUnread(next);
      return next;
    });
    // If we filtered items out, refetch to pull in any newly-allowed rows.
    void fetchNotifications();
  }, [prefs, shouldShow, recomputeUnread, fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(
      `user-notifications-${user.id}-${channelInstanceId.current}`
    );

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (!shouldShow(newNotif, prefsRef.current)) return;
          setNotifications((prev) => {
            const next = [newNotif, ...prev.filter((item) => item.id !== newNotif.id)].slice(0, 20);
            setUnreadCount(next.filter((item) => !item.is_read).length);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => {
            const next = prev.map((item) =>
              item.id === updated.id ? { ...item, ...updated } : item
            );
            setUnreadCount(next.filter((item) => !item.is_read).length);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string })?.id;
          if (!removedId) return;
          setNotifications((prev) => {
            const next = prev.filter((item) => item.id !== removedId);
            setUnreadCount(next.filter((item) => !item.is_read).length);
            return next;
          });
        }
      );

    channel.subscribe();

    // Live-update effective prefs when the user changes their toggles.
    const prefsChannel = supabase
      .channel(`user-push-prefs-${user.id}-${channelInstanceId.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "provider_push_settings",
          filter: `provider_id=eq.${user.id}`,
        },
        () => {
          void loadPrefs();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenant_push_defaults" },
        () => {
          void loadPrefs();
        }
      );
    prefsChannel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(prefsChannel);
    };
  }, [user, shouldShow, loadPrefs]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  return {
    notifications,
    unreadCount,
    prefs,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
