import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Heading, AppCard, LoadingState } from "@/components/ui/app";
import { Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

const KEYS = [
  "sponsorship_enabled",
  "sponsorship_price_per_day",
  "sponsorship_durations",
  "sponsorship_max_per_provider",
  "sponsorship_show_on_homepage",
  "sponsorship_show_on_category",
  "sponsorship_search_boost",
] as const;

type Key = (typeof KEYS)[number];

const DEFAULTS: Record<Key, string> = {
  sponsorship_enabled: "true",
  sponsorship_price_per_day: "0.65",
  sponsorship_durations: "7,14,30,60,90",
  sponsorship_max_per_provider: "5",
  sponsorship_show_on_homepage: "true",
  sponsorship_show_on_category: "true",
  sponsorship_search_boost: "25",
};

const asBool = (v: string) => v === "true" || v === "1";

export default function SponsorshipSettingsPage() {
  const [values, setValues] = useState<Record<Key, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", KEYS as unknown as string[]);
      const next = { ...DEFAULTS };
      (data || []).forEach((row: any) => {
        if ((KEYS as readonly string[]).includes(row.key)) next[row.key as Key] = row.value ?? "";
      });
      setValues(next);
      setLoading(false);
    })();
  }, []);

  const set = (k: Key, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const rows = KEYS.map((k) => ({ key: k, value: values[k] ?? "", is_secret: false }));
      const { error } = await supabase
        .from("platform_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Sponsorship settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1}  className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" /> Sponsorship Settings
          </Heading>
          <p className="text-fs-sm text-muted-foreground mt-1">
            Configure pricing, placement, and ranking for sponsored services. Changes take effect immediately.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </header>

      <AppCard className="p-5 space-y-4">
        <Heading level={2} >Availability</Heading>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-fs-sm font-medium">Enable sponsorship feature</Label>
            <p className="text-fs-xs text-muted-foreground">
              When off, providers cannot purchase new sponsorships. Existing live listings continue until expiry.
            </p>
          </div>
          <Switch
            checked={asBool(values.sponsorship_enabled)}
            onCheckedChange={(v) => set("sponsorship_enabled", v ? "true" : "false")}
          />
        </div>
      </AppCard>

      <AppCard className="p-5 space-y-4">
        <Heading level={2} >Pricing & duration</Heading>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-fs-sm">Price per day (USD)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={values.sponsorship_price_per_day}
              onChange={(e) => set("sponsorship_price_per_day", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-fs-sm">Allowed durations (days)</Label>
            <Input
              value={values.sponsorship_durations}
              onChange={(e) => set("sponsorship_durations", e.target.value)}
              placeholder="7,14,30,60,90"
            />
            <p className="text-fs-xs text-muted-foreground">Comma-separated list shown to providers.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-fs-sm">Max active sponsored listings per provider</Label>
            <Input
              type="number" min={1} step="1"
              value={values.sponsorship_max_per_provider}
              onChange={(e) => set("sponsorship_max_per_provider", e.target.value)}
            />
          </div>
        </div>
      </AppCard>

      <AppCard className="p-5 space-y-4">
        <Heading level={2} >Placement</Heading>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-fs-sm font-medium">Show on homepage</Label>
            <p className="text-fs-xs text-muted-foreground">Feature sponsored services in the homepage carousels.</p>
          </div>
          <Switch
            checked={asBool(values.sponsorship_show_on_homepage)}
            onCheckedChange={(v) => set("sponsorship_show_on_homepage", v ? "true" : "false")}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-fs-sm font-medium">Show on category pages</Label>
            <p className="text-fs-xs text-muted-foreground">Pin sponsored services to the top of category listings.</p>
          </div>
          <Switch
            checked={asBool(values.sponsorship_show_on_category)}
            onCheckedChange={(v) => set("sponsorship_show_on_category", v ? "true" : "false")}
          />
        </div>
      </AppCard>

      <AppCard className="p-5 space-y-4">
        <Heading level={2} >Search ranking</Heading>
        <div className="space-y-1.5">
          <Label className="text-fs-sm">Search ranking boost (%)</Label>
          <Input
            type="number" min={0} max={500} step="1"
            value={values.sponsorship_search_boost}
            onChange={(e) => set("sponsorship_search_boost", e.target.value)}
          />
          <p className="text-fs-xs text-muted-foreground">
            Percentage boost applied to sponsored listings when ranking search results. 0 disables the boost.
          </p>
        </div>
      </AppCard>
    </div>
  );
}