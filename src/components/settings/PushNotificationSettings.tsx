import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";

type PushCategories = {
  push_enabled: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  payment_updates: boolean;
  review_alerts: boolean;
  marketing: boolean;
};

type PushSettings = PushCategories & { overrides_defaults: boolean };

const CATEGORY_DEFAULTS: PushCategories = {
  push_enabled: true,
  booking_updates: true,
  new_messages: true,
  payment_updates: true,
  review_alerts: true,
  marketing: false,
};

const ALERT_ROWS: Array<{ key: keyof PushCategories; label: string; description: string }> = [
  { key: "booking_updates", label: "Booking updates", description: "New bookings, reschedules and cancellations." },
  { key: "new_messages", label: "New messages", description: "Chat replies from customers." },
  { key: "payment_updates", label: "Payments & payouts", description: "Deposits, invoices and withdrawal status." },
  { key: "review_alerts", label: "Reviews", description: "New reviews and rating changes." },
  { key: "marketing", label: "Product updates", description: "Occasional tips and platform announcements." },
];

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PushSettings>({ ...CATEGORY_DEFAULTS, overrides_defaults: false });
  const [defaults, setDefaults] = useState<PushCategories>(CATEGORY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: mine, error: mineErr }, { data: tenant }] = await Promise.all([
        supabase
          .from("provider_push_settings")
          .select("push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing, overrides_defaults")
          .eq("provider_id", user.id)
          .maybeSingle(),
        supabase
          .from("tenant_push_defaults")
          .select("push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing")
          .eq("id", true)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (mineErr) {
        console.error(mineErr);
        toast.error("Could not load push settings");
      }
      if (tenant) setDefaults(tenant as PushCategories);
      if (mine) setSettings(mine as PushSettings);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const persist = async (next: PushSettings) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("provider_push_settings")
      .upsert({ provider_id: user.id, ...next }, { onConflict: "provider_id" });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Could not save push settings");
    }
  };

  const update = (patch: Partial<PushSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void persist(next);
  };

  const effective: PushCategories = settings.overrides_defaults ? settings : { ...defaults };
  const usingDefaults = !settings.overrides_defaults;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <CardTitle>Push notifications</CardTitle>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          {usingDefaults
            ? "You're using the platform defaults set by your admin. Turn on override to customize."
            : "You've overridden the platform defaults. Turn off override to sync with your admin's settings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3 bg-muted/40">
          <div className="space-y-0.5">
            <Label className="text-base">Override platform defaults</Label>
            <p className="text-sm text-muted-foreground">Customize your own push preferences instead of inheriting.</p>
          </div>
          <Switch
            checked={settings.overrides_defaults}
            disabled={loading}
            onCheckedChange={(v) => update({ overrides_defaults: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Enable push notifications</Label>
            <p className="text-sm text-muted-foreground">Master switch — turn all push alerts on or off.</p>
          </div>
          <Switch
            checked={effective.push_enabled}
            disabled={loading || usingDefaults}
            onCheckedChange={(v) => update({ push_enabled: v })}
          />
        </div>
        <Separator />
        <div className="space-y-4">
          {ALERT_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{row.label}</Label>
                <p className="text-sm text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                checked={Boolean(effective[row.key])}
                disabled={loading || usingDefaults || !effective.push_enabled}
                onCheckedChange={(v) => update({ [row.key]: v } as Partial<PushSettings>)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
