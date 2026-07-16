import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Percent, DollarSign, Save, Trash2 } from "lucide-react";
import { Heading, LoadingState } from "@/components/ui/app";

type Category = { id: string; name: string };
type Override = { id?: string; category_id: string; commission_type: "percent" | "fixed"; commission_value: number };

export default function CommissionSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [percent, setPercent] = useState("10");
  const [fixed, setFixed] = useState("0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { data: cats }, { data: ovs }] = await Promise.all([
        supabase.from("platform_settings").select("key, value").in("key", [
          "platform_commission_rate", "platform_commission_type", "platform_commission_fixed",
        ]),
        supabase.from("service_categories").select("id, name").order("name"),
        supabase.from("category_commissions").select("id, category_id, commission_type, commission_value"),
      ]);
      const map = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));
      setType((map.platform_commission_type === "fixed" ? "fixed" : "percent"));
      setPercent(map.platform_commission_rate ?? "10");
      setFixed(map.platform_commission_fixed ?? "0");
      setCategories(cats || []);
      setOverrides((ovs as Override[]) || []);
      setLoading(false);
    })();
  }, []);

  const saveDefaults = async () => {
    setSaving(true);
    const rows = [
      { key: "platform_commission_type", value: type, is_secret: false },
      { key: "platform_commission_rate", value: String(Number(percent) || 0), is_secret: false },
      { key: "platform_commission_fixed", value: String(Number(fixed) || 0), is_secret: false },
    ];
    const { error } = await supabase.from("platform_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Commission defaults saved");
  };

  const addOverride = () => {
    const unused = categories.find((c) => !overrides.some((o) => o.category_id === c.id));
    if (!unused) return toast.info("All categories have overrides");
    setOverrides((p) => [...p, { category_id: unused.id, commission_type: "percent", commission_value: 0 }]);
  };

  const removeOverride = async (idx: number) => {
    const o = overrides[idx];
    if (o.id) await supabase.from("category_commissions").delete().eq("id", o.id);
    setOverrides((p) => p.filter((_, i) => i !== idx));
  };

  const saveOverride = async (idx: number) => {
    const o = overrides[idx];
    const payload = {
      category_id: o.category_id,
      commission_type: o.commission_type,
      commission_value: Number(o.commission_value) || 0,
    };
    const { data, error } = await supabase
      .from("category_commissions")
      .upsert(payload, { onConflict: "category_id" })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setOverrides((p) => p.map((x, i) => (i === idx ? { ...x, id: data!.id } : x)));
    toast.success("Override saved");
  };

  if (loading) return <LoadingState variant="section" />;

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <Heading level={1} >Commission Settings</Heading>
        <p className="text-description-sm">Configure platform fees applied after each completed job.</p>
      </div>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <Heading level={2} >Default commission</Heading>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1"><Percent className="w-3 h-3" /> Percentage</Label>
            <Input type="number" min="0" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} disabled={type !== "percent"} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Fixed</Label>
            <Input type="number" min="0" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} disabled={type !== "fixed"} />
          </div>
        </div>
        <Button onClick={saveDefaults} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> Save defaults
        </Button>
      </div>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level={2} >Per-category overrides</Heading>
            <p className="text-fs-xs text-muted-foreground">Categories without an override use the default.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addOverride}>Add override</Button>
        </div>
        {overrides.length === 0 ? (
          <p className="text-fs-sm text-muted-foreground py-4">No category overrides configured.</p>
        ) : (
          <div className="space-y-3">
            {overrides.map((o, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_140px_140px_auto_auto] gap-2 items-end">
                <div>
                  <Label>Category</Label>
                  <Select value={o.category_id} onValueChange={(v) => setOverrides((p) => p.map((x, idx) => (idx === i ? { ...x, category_id: v } : x)))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={o.commission_type} onValueChange={(v) => setOverrides((p) => p.map((x, idx) => (idx === i ? { ...x, commission_type: v as any } : x)))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">$</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input type="number" min="0" step="0.01" value={o.commission_value}
                    onChange={(e) => setOverrides((p) => p.map((x, idx) => (idx === i ? { ...x, commission_value: Number(e.target.value) } : x)))} />
                </div>
                <Button size="sm" onClick={() => saveOverride(i)} className="gap-1"><Save className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => removeOverride(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}