import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Heading, LoadingState } from "@/components/ui/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, EyeOff, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string };
type Sub = { id: string; name: string; category_id: string; sort_order: number | null };
type OverrideRow = { subcategory_id: string; is_hidden: boolean; sort_order: number | null };

type Draft = { hidden: boolean; order: number };

export default function CategoryOverridesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [initial, setInitial] = useState<Record<string, Draft>>({});

  const load = async () => {
    setLoading(true);
    const [c, s, o] = await Promise.all([
      supabase.from("service_categories").select("id, name").order("sort_order").order("name"),
      supabase.from("service_subcategories").select("id, name, category_id, sort_order").order("name"),
      supabase.from("subcategory_overrides").select("subcategory_id, is_hidden, sort_order"),
    ]);
    const catsData = (c.data as Category[]) ?? [];
    const subsData = (s.data as Sub[]) ?? [];
    const overrides = new Map<string, OverrideRow>();
    for (const row of (o.data as OverrideRow[]) ?? []) overrides.set(row.subcategory_id, row);

    // Build drafts per category: current effective order = override.sort_order ?? base sort_order.
    const draft: Record<string, Draft> = {};
    const byCat = new Map<string, Sub[]>();
    for (const sub of subsData) {
      const arr = byCat.get(sub.category_id) ?? [];
      arr.push(sub);
      byCat.set(sub.category_id, arr);
    }
    for (const [, arr] of byCat) {
      arr.sort((a, b) => {
        const ao = overrides.get(a.id)?.sort_order ?? a.sort_order ?? Number.POSITIVE_INFINITY;
        const bo = overrides.get(b.id)?.sort_order ?? b.sort_order ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
      arr.forEach((sub, idx) => {
        draft[sub.id] = {
          hidden: overrides.get(sub.id)?.is_hidden ?? false,
          order: idx,
        };
      });
    }
    setCats(catsData);
    setSubs(subsData);
    setDrafts(draft);
    setInitial(JSON.parse(JSON.stringify(draft)));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    return cats.map((c) => {
      const items = subs
        .filter((s) => s.category_id === c.id)
        .sort((a, b) => (drafts[a.id]?.order ?? 0) - (drafts[b.id]?.order ?? 0));
      return { cat: c, items };
    });
  }, [cats, subs, drafts]);

  const dirty = useMemo(() => {
    return Object.keys(drafts).some((id) => {
      const a = drafts[id]; const b = initial[id];
      return !b || a.hidden !== b.hidden || a.order !== b.order;
    });
  }, [drafts, initial]);

  const move = (catId: string, subId: string, dir: -1 | 1) => {
    const items = grouped.find((g) => g.cat.id === catId)?.items ?? [];
    const idx = items.findIndex((s) => s.id === subId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const next = { ...drafts };
    const a = items[idx].id, b = items[target].id;
    const ao = next[a].order, bo = next[b].order;
    next[a] = { ...next[a], order: bo };
    next[b] = { ...next[b], order: ao };
    setDrafts(next);
  };

  const toggleHide = (subId: string, hidden: boolean) => {
    setDrafts((d) => ({ ...d, [subId]: { ...d[subId], hidden } }));
  };

  const resetAll = async () => {
    if (!confirm("Reset all overrides? This shows every subcategory and clears custom ordering.")) return;
    setSaving(true);
    const { error } = await supabase.from("subcategory_overrides").delete().not("subcategory_id", "is", null);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("All overrides cleared");
    load();
  };

  const save = async () => {
    setSaving(true);
    // Upsert one row per subcategory with its new hidden + order.
    const rows = Object.entries(drafts).map(([subcategory_id, d]) => ({
      subcategory_id,
      is_hidden: d.hidden,
      sort_order: d.order,
    }));
    const { error } = await supabase
      .from("subcategory_overrides")
      .upsert(rows, { onConflict: "subcategory_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Overrides saved");
    setInitial(JSON.parse(JSON.stringify(drafts)));
  };

  return (
    <AdminPage>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading level={1}>Category Overrides</Heading>
            <p className="text-description-sm mt-1">
              Hide or reorder subcategories shown to customers. Applies to browse pages, category
              pages, and the header mega menu.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll} disabled={saving || loading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset all
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving || loading}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {grouped.map(({ cat, items }) => {
              const hiddenCount = items.filter((s) => drafts[s.id]?.hidden).length;
              return (
                <Card key={cat.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{cat.name}</span>
                      <div className="flex gap-1">
                        <Badge variant="secondary">{items.length} subs</Badge>
                        {hiddenCount > 0 && (
                          <Badge variant="destructive">
                            <EyeOff className="mr-1 h-3 w-3" />
                            {hiddenCount} hidden
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {items.map((s, i) => {
                      const d = drafts[s.id];
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2 rounded-md border p-2 text-sm ${d?.hidden ? "opacity-60" : ""}`}
                        >
                          <div className="flex flex-col">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => move(cat.id, s.id, -1)}
                              disabled={i === 0}
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => move(cat.id, s.id, 1)}
                              disabled={i === items.length - 1}
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="flex-1">{s.name}</span>
                          <span className="text-xs text-muted-foreground">#{i + 1}</span>
                          <Switch
                            checked={!d?.hidden}
                            onCheckedChange={(v) => toggleHide(s.id, !v)}
                            aria-label={d?.hidden ? "Show" : "Hide"}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
