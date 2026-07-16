import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";

type Defaults = {
  push_enabled: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  payment_updates: boolean;
  review_alerts: boolean;
  marketing: boolean;
};

const INITIAL: Defaults = {
  push_enabled: true,
  booking_updates: true,
  new_messages: true,
  payment_updates: true,
  review_alerts: true,
  marketing: false,
};

const ROWS: Array<{ key: keyof Defaults; label: string; description: string }> = [
  { key: "booking_updates", label: "Booking updates", description: "New bookings, reschedules, cancellations." },
  { key: "new_messages", label: "New messages", description: "Chat replies from customers." },
  { key: "payment_updates", label: "Payments & payouts", description: "Deposits, invoices, withdrawal status." },
  { key: "review_alerts", label: "Reviews", description: "New reviews and rating changes." },
  { key: "marketing", label: "Product updates", description: "Tips and platform announcements." },
];

export default function TenantPushDefaultsPage() {
  const { user } = useAuth();
  const [values, setValues] = useState<Defaults>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tenant_push_defaults")
        .select("push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing")
        .eq("id", true)
        .maybeSingle();
      if (error) {
        console.error(error);
        toast.error("Could not load tenant defaults");
      } else if (data) {
        setValues(data as Defaults);
      }
      setLoading(false);
    })();
  }, []);

  const update = async (patch: Partial<Defaults>) => {
    const next = { ...values, ...patch };
    setValues(next);
    setSaving(true);
    const { error } = await supabase
      .from("tenant_push_defaults")
      .upsert({ id: true, ...next, updated_by: user?.id ?? null }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Could not save tenant defaults");
    } else {
      toast.success("Defaults updated");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Push notification defaults</h1>
        <p className="text-description-sm">
          Platform-wide defaults for provider push notifications. Providers inherit these unless they turn on override.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <CardTitle>Tenant defaults</CardTitle>
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <CardDescription>Changes apply immediately to providers who haven't overridden their settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Push notifications enabled</Label>
              <p className="text-sm text-muted-foreground">Master default — off blocks all categories.</p>
            </div>
            <Switch
              checked={values.push_enabled}
              disabled={loading}
              onCheckedChange={(v) => update({ push_enabled: v })}
            />
          </div>
          <Separator />
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{row.label}</Label>
                <p className="text-sm text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                checked={Boolean(values[row.key])}
                disabled={loading || !values.push_enabled}
                onCheckedChange={(v) => update({ [row.key]: v } as Partial<Defaults>)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
