import { useEffect, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/app";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_WEIGHTS,
  RANKING_SETTING_KEY,
  loadRankingWeights,
  type RankingWeights,
} from "@/lib/searchRanking";

const FIELDS: { key: keyof RankingWeights; label: string; help: string }[] = [
  { key: "sponsored", label: "Active sponsored services", help: "Top priority: boost providers with at least one active sponsored service." },
  { key: "verified", label: "Verified providers", help: "Boost providers with approved verification documents." },
  { key: "rating", label: "Higher ratings", help: "Boost providers with higher average review scores." },
  { key: "jobs", label: "More completed jobs", help: "Boost providers with proven booking history." },
  { key: "subscription", label: "Active subscriptions", help: "Boost providers on a paid subscription." },
  { key: "recency", label: "Recently active", help: "Boost providers active in the last 90 days." },
];

export default function SearchRankingPage() {
  const { user } = useAuth();
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRankingWeights().then((w) => {
      setWeights(w);
      setLoading(false);
    });
  }, []);

  const total = FIELDS.reduce((a, f) => a + weights[f.key], 0);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: RANKING_SETTING_KEY,
        value: JSON.stringify(weights),
        is_secret: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Ranking weights saved");
  }

  if (loading) {
    return (
      <AdminPage title="Search Ranking">
        <LoadingState />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Search Ranking"
      subtitle="Tune how providers are ranked in marketplace search results."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
            <RotateCcw className="size-4 mr-2" /> Reset
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4 mr-2" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Ranking weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIELDS.map((f) => {
            const v = weights[f.key];
            const pct = total ? Math.round((v / total) * 100) : 0;
            return (
              <div key={f.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{f.label}</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    weight {v} · {pct}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[v]}
                  onValueChange={([nv]) => setWeights({ ...weights, [f.key]: nv })}
                />
                <p className="text-xs text-muted-foreground">{f.help}</p>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground border-t pt-4">
            Weights are normalized — only their relative size matters. Set any factor to 0 to ignore it.
            Changes apply to the Smart Match sort on the provider marketplace.
          </p>
        </CardContent>
      </Card>
    </AdminPage>
  );
}