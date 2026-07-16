import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronRight, Pencil, Plus, Trash2, MapPin } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Heading } from "@/components/ui/app";

type Country = { id: string; name: string; code: string | null; sort_order: number; is_active: boolean };
type Province = { id: string; country_id: string; name: string; code: string | null; sort_order: number; is_active: boolean };
type City = { id: string; province_id: string; name: string; sort_order: number; is_active: boolean };

type EditState =
  | { kind: "country"; row: Partial<Country> | null }
  | { kind: "province"; row: Partial<Province> | null }
  | { kind: "city"; row: Partial<City> | null }
  | null;

export default function LocationsPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selCountry, setSelCountry] = useState<string | null>(null);
  const [selProvince, setSelProvince] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, p, ci] = await Promise.all([
      supabase.from("countries").select("*").order("sort_order").order("name"),
      supabase.from("provinces").select("*").order("sort_order").order("name"),
      supabase.from("cities").select("*").order("sort_order").order("name"),
    ]);
    if (c.error || p.error || ci.error) toast.error("Failed to load locations");
    setCountries((c.data as Country[]) || []);
    setProvinces((p.data as Province[]) || []);
    setCities((ci.data as City[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredProvinces = selCountry ? provinces.filter(p => p.country_id === selCountry) : [];
  const filteredCities = selProvince ? cities.filter(c => c.province_id === selProvince) : [];

  const remove = async (table: "countries" | "provinces" | "cities", id: string) => {
    if (!confirm("Delete this location? Children will also be removed.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    if (table === "countries" && selCountry === id) { setSelCountry(null); setSelProvince(null); }
    if (table === "provinces" && selProvince === id) setSelProvince(null);
    load();
  };

  const toggleActive = async (table: "countries" | "provinces" | "cities", id: string, value: boolean) => {
    const { error } = await supabase.from(table).update({ is_active: value }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const save = async () => {
    if (!edit) return;
    const row = edit.row || {};
    const name = String((row as any).name || "").trim();
    if (!name) return toast.error("Name is required");

    if (edit.kind === "country") {
      const payload = { name, code: (row as Country).code || null, sort_order: (row as Country).sort_order ?? countries.length, is_active: (row as Country).is_active ?? true };
      const q = (row as Country).id
        ? supabase.from("countries").update(payload).eq("id", (row as Country).id!)
        : supabase.from("countries").insert(payload);
      const { error } = await q;
      if (error) return toast.error(error.message);
    } else if (edit.kind === "province") {
      if (!selCountry) return toast.error("Select a country first");
      const payload = { name, code: (row as Province).code || null, country_id: selCountry, sort_order: (row as Province).sort_order ?? filteredProvinces.length, is_active: (row as Province).is_active ?? true };
      const q = (row as Province).id
        ? supabase.from("provinces").update(payload).eq("id", (row as Province).id!)
        : supabase.from("provinces").insert(payload);
      const { error } = await q;
      if (error) return toast.error(error.message);
    } else {
      if (!selProvince) return toast.error("Select a province first");
      const payload = { name, province_id: selProvince, sort_order: (row as City).sort_order ?? filteredCities.length, is_active: (row as City).is_active ?? true };
      const q = (row as City).id
        ? supabase.from("cities").update(payload).eq("id", (row as City).id!)
        : supabase.from("cities").insert(payload);
      const { error } = await q;
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setEdit(null);
    load();
  };

  const Column = <T extends { id: string; name: string; sort_order: number; is_active: boolean }>(props: {
    title: string;
    rows: T[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onAdd: () => void;
    onEdit: (row: T) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string, v: boolean) => void;
    emptyHint: string;
    disabled?: boolean;
  }) => (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-fs-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> {props.title}</CardTitle>
        <Button size="sm" onClick={props.onAdd} disabled={props.disabled}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5 overflow-auto max-h-[60vh]">
        {props.disabled ? (
          <p className="text-fs-xs text-muted-foreground italic">{props.emptyHint}</p>
        ) : props.rows.length === 0 ? (
          <p className="text-fs-xs text-muted-foreground italic">No items yet.</p>
        ) : props.rows.map(r => (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-2 p-2 rounded-sm border ${props.selectedId === r.id ? "bg-accent/40 border-accent" : "hover:bg-muted/40"}`}
          >
            <button
              className="flex-1 text-left flex items-center gap-2"
              onClick={() => props.onSelect?.(r.id)}
            >
              <span className="text-fs-sm font-medium">{r.name}</span>
              {!r.is_active && <span className="text-fs-xs text-muted-foreground">(inactive)</span>}
              {props.onSelect && <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />}
            </button>
            <Switch checked={r.is_active} onCheckedChange={(v) => props.onToggle(r.id, v)} />
            <Button variant="ghost" size="sm" className="px-2" onClick={() => props.onEdit(r)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => props.onDelete(r.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <Heading level={1} >Locations</Heading>
        <p className="text-description-sm">Manage countries, provinces, and cities used in registration, search, and job posting.</p>
      </div>

      {loading ? (
        <p className="text-fs-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Column
            title="Countries"
            rows={countries}
            selectedId={selCountry}
            onSelect={(id) => { setSelCountry(id); setSelProvince(null); }}
            onAdd={() => setEdit({ kind: "country", row: {} })}
            onEdit={(r) => setEdit({ kind: "country", row: r })}
            onDelete={(id) => remove("countries", id)}
            onToggle={(id, v) => toggleActive("countries", id, v)}
            emptyHint=""
          />
          <Column
            title="Provinces / States"
            rows={filteredProvinces}
            selectedId={selProvince}
            onSelect={(id) => setSelProvince(id)}
            onAdd={() => setEdit({ kind: "province", row: {} })}
            onEdit={(r) => setEdit({ kind: "province", row: r })}
            onDelete={(id) => remove("provinces", id)}
            onToggle={(id, v) => toggleActive("provinces", id, v)}
            disabled={!selCountry}
            emptyHint="Select a country to manage its provinces."
          />
          <Column
            title="Cities"
            rows={filteredCities}
            onAdd={() => setEdit({ kind: "city", row: {} })}
            onEdit={(r) => setEdit({ kind: "city", row: r })}
            onDelete={(id) => remove("cities", id)}
            onToggle={(id, v) => toggleActive("cities", id, v)}
            disabled={!selProvince}
            emptyHint="Select a province to manage its cities."
          />
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.row && (edit.row as any).id ? "Edit" : "Add"} {edit?.kind}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  autoFocus
                  maxLength={100}
                  value={(edit.row as any)?.name ?? ""}
                  onChange={(e) => setEdit({ ...edit, row: { ...(edit.row as any), name: e.target.value } } as EditState)}
                />
              </div>
              {edit.kind !== "city" && (
                <div>
                  <Label>Code (optional)</Label>
                  <Input
                    maxLength={10}
                    placeholder={edit.kind === "country" ? "e.g. US" : "e.g. CA"}
                    value={(edit.row as any)?.code ?? ""}
                    onChange={(e) => setEdit({ ...edit, row: { ...(edit.row as any), code: e.target.value } } as EditState)}
                  />
                </div>
              )}
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={(edit.row as any)?.sort_order ?? 0}
                  onChange={(e) => setEdit({ ...edit, row: { ...(edit.row as any), sort_order: Number(e.target.value) } } as EditState)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={(edit.row as any)?.is_active ?? true}
                  onCheckedChange={(v) => setEdit({ ...edit, row: { ...(edit.row as any), is_active: v } } as EditState)}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}