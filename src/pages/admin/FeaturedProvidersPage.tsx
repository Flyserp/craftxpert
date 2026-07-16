import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/layouts/PageShell";
import { AppCard, LoadingState, EmptyState } from "@/components/ui/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Star, Search, Calendar, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Provider {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  address: string | null;
  is_featured: boolean;
  featured_until: string | null;
  featured_rank: number | null;
}

export default function FeaturedProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState("8");
  const [enabled, setEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "provider");
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) { setProviders([]); setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, address, is_featured, featured_until, featured_rank")
      .in("user_id", ids)
      .order("is_featured", { ascending: false })
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("display_name");
    setProviders((data || []) as Provider[]);

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["homepage_featured_limit", "homepage_featured_enabled"]);
    settings?.forEach((s) => {
      if (s.key === "homepage_featured_limit") setLimit(s.value || "8");
      if (s.key === "homepage_featured_enabled") setEnabled(s.value !== "false");
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateProvider = async (id: string, patch: Partial<Provider>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    fetchData();
  };

  const toggleFeatured = (p: Provider) =>
    updateProvider(p.user_id, {
      is_featured: !p.is_featured,
      featured_until: !p.is_featured ? p.featured_until : null,
    });

  const setExpiry = (p: Provider, days: number) => {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    updateProvider(p.user_id, { is_featured: true, featured_until: until });
  };

  const setRank = (p: Provider, rank: number) =>
    updateProvider(p.user_id, { featured_rank: rank });

  const saveSettings = async () => {
    setSavingSettings(true);
    const rows = [
      { key: "homepage_featured_limit", value: String(parseInt(limit) || 8) },
      { key: "homepage_featured_enabled", value: enabled ? "true" : "false" },
    ];
    for (const r of rows) {
      await supabase.from("platform_settings").upsert(r, { onConflict: "key" });
    }
    setSavingSettings(false);
    toast.success("Homepage settings saved");
  };

  const filtered = providers.filter((p) =>
    !q.trim() ||
    (p.display_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (p.address || "").toLowerCase().includes(q.toLowerCase())
  );

  const featuredCount = providers.filter((p) => p.is_featured).length;

  return (
    <PageShell title="Featured Providers" description="Manually feature providers on the homepage and category pages.">
      <AppCard className="p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-fs-sm font-semibold text-heading mb-1">Homepage Featured Section</p>
            <p className="text-fs-xs text-muted-foreground">Configure how the section appears publicly.</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-fs-xs">Show section</Label>
              <div className="h-10 flex items-center"><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
            </div>
            <div>
              <Label className="text-fs-xs">Max providers shown</Label>
              <Input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-28" />
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="gap-1.5"><Save className="w-4 h-4" /> Save</Button>
          </div>
        </div>
      </AppCard>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search providers…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{featuredCount} featured</Badge>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Star} title="No providers" description="No provider profiles match your search." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const active = p.is_featured && (!p.featured_until || new Date(p.featured_until) > new Date());
            return (
              <AppCard key={p.user_id} className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-sm bg-primary/10 overflow-hidden flex items-center justify-center font-semibold text-primary">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.display_name?.slice(0, 2).toUpperCase() || "P")}
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-heading">{p.display_name || "Provider"}</p>
                    <p className="text-fs-xs text-muted-foreground">{p.address || "—"}</p>
                  </div>

                  {active && (
                    <Badge className="gap-1"><Star className="w-3 h-3 fill-current" /> Featured</Badge>
                  )}
                  {p.is_featured && p.featured_until && (
                    <span className="text-fs-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> until {format(new Date(p.featured_until), "MMM d, yyyy")}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Rank"
                      value={p.featured_rank ?? ""}
                      onChange={(e) => setRank(p, parseInt(e.target.value) || 0)}
                      className="w-20 h-9"
                    />
                    <Button size="sm" variant="outline" onClick={() => setExpiry(p, 30)}>+30d</Button>
                    <Button size="sm" variant={active ? "destructive" : "default"} onClick={() => toggleFeatured(p)}>
                      {active ? "Remove" : "Feature"}
                    </Button>
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}