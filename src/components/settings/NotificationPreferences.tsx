import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

export const EVENT_TYPES = [
  { key: "bookings", label: "Bookings", desc: "Confirmations, reschedules and cancellations" },
  { key: "messages", label: "Messages", desc: "New chat messages from providers" },
  { key: "job_alerts", label: "Job alerts", desc: "New matching jobs and application updates" },
  { key: "reviews", label: "Reviews", desc: "Review requests and replies" },
  { key: "verification", label: "Verification", desc: "ID and document verification status changes" },
  { key: "subscription_reminders", label: "Subscription reminders", desc: "Renewals, expirations and plan changes" },
  { key: "payments", label: "Payments & wallet", desc: "Receipts, refunds and wallet activity" },
  { key: "marketing", label: "Promotions", desc: "Deals, coupons and product updates" },
] as const;

type Channel = "in_app" | "email" | "sms" | "push";
type PrefRow = {
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
};

const DEFAULT: Omit<PrefRow, "event_type"> = {
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
};

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, PrefRow>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination([...EVENT_TYPES], 5);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("event_type, in_app_enabled, email_enabled, sms_enabled, push_enabled" as any)
        .eq("user_id", user.id);
      if (error) toast.error("Could not load preferences");
      const map: Record<string, PrefRow> = {};
      EVENT_TYPES.forEach((e) => {
        const row = ((data as any[]) || []).find((r) => r.event_type === e.key);
        map[e.key] = row
          ? {
              event_type: e.key,
              in_app_enabled: row.in_app_enabled ?? true,
              email_enabled: row.email_enabled ?? true,
              sms_enabled: row.sms_enabled ?? false,
              push_enabled: row.push_enabled ?? true,
            }
          : { event_type: e.key, ...DEFAULT };
      });
      setPrefs(map);
      setLoading(false);
    })();
  }, [user]);

  const toggle = async (eventType: string, channel: Channel, next: boolean) => {
    if (!user) return;
    const current = prefs[eventType];
    const updated: PrefRow = { ...current, [`${channel}_enabled`]: next };
    setPrefs((p) => ({ ...p, [eventType]: updated }));
    setSavingKey(`${eventType}-${channel}`);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          event_type: eventType,
          in_app_enabled: updated.in_app_enabled,
          email_enabled: updated.email_enabled,
          sms_enabled: updated.sms_enabled,
          push_enabled: updated.push_enabled,
        } as any,
        { onConflict: "user_id,event_type" },
      );
    setSavingKey(null);
    if (error) {
      toast.error("Could not save preference");
      setPrefs((p) => ({ ...p, [eventType]: current }));
    }
  };

  return (
    <section className="bg-card border border-border rounded-sm p-6 animate-reveal-delay-2 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        <Heading level={2} >Notification preferences</Heading>
      </div>
      <p className="text-fs-xs text-muted-foreground">
        Choose how you'd like to be notified for each type of event. <span className="font-medium">In-app</span> shows in the notification bell; <span className="font-medium">Email</span> sends to your inbox.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-fs-sm">
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
              <th className="py-2 pr-4 font-medium">Event</th>
              <th className="py-2 px-3 font-medium text-center w-20">In-app</th>
              <th className="py-2 px-3 font-medium text-center w-20">Email</th>
              <th className="py-2 px-3 font-medium text-center w-20">SMS</th>
              <th className="py-2 px-3 font-medium text-center w-20">Push</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {pageItems.map((e) => {
              const row = prefs[e.key];
              return (
                <tr key={e.key}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-heading">{e.label}</p>
                    <p className="text-fs-xs text-muted-foreground">{e.desc}</p>
                  </td>
                  {(["in_app", "email", "sms", "push"] as Channel[]).map((ch) => (
                    <td key={ch} className="py-3 px-3 text-center">
                      {loading || !row ? (
                        <Loader2 className="w-3.5 h-3.5 mx-auto animate-spin text-muted-foreground/40" />
                      ) : (
                        <Switch
                          checked={row[`${ch}_enabled` as const]}
                          disabled={savingKey === `${e.key}-${ch}`}
                          onCheckedChange={(v) => toggle(e.key, ch, v)}
                          aria-label={`${e.label} ${ch.replace("_", "-")}`}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <NumberedPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        className="mt-2"
          onPageSizeChange={setPageSize}
      />
    </section>
  );
}
