import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Star, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { Heading } from "@/components/ui/app";

type ServiceRow = {
  id: string;
  title: string;
  vendor_id: string;
  is_active: boolean;
  is_sponsored: boolean;
  sponsored_until: string | null;
  is_featured: boolean;
  featured_until: string | null;
  vendor?: { display_name: string | null } | null;
};

type Filter = "all" | "featured" | "sponsored" | "none";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

const isLive = (iso: string | null) => !!iso && new Date(iso) > new Date();

export default function ServicePromotionsPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // dialog state
  const [target, setTarget] = useState<ServiceRow | null>(null);
  const [kind, setKind] = useState<"featured" | "sponsored">("featured");
  const [days, setDays] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_services")
      .select(
        "id,title,vendor_id,is_active,is_sponsored,sponsored_until,is_featured,featured_until"
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    const services = (data as any[]) ?? [];
    const vendorIds = Array.from(new Set(services.map((s) => s.vendor_id).filter(Boolean)));
    let nameMap = new Map<string, string>();
    if (vendorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", vendorIds);
      nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name]));
    }
    setRows(services.map((s) => ({ ...s, vendor: { display_name: nameMap.get(s.vendor_id) ?? "—" } })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.title} ${r.vendor?.display_name ?? ""}`.toLowerCase().includes(q)) return false;
      const featured = r.is_featured && isLive(r.featured_until);
      const sponsored = r.is_sponsored && isLive(r.sponsored_until);
      if (filter === "featured") return featured;
      if (filter === "sponsored") return sponsored;
      if (filter === "none") return !featured && !sponsored;
      return true;
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => ({
    featured: rows.filter((r) => r.is_featured && isLive(r.featured_until)).length,
    sponsored: rows.filter((r) => r.is_sponsored && isLive(r.sponsored_until)).length,
    total: rows.length,
  }), [rows]);

  const openPromote = (row: ServiceRow, k: "featured" | "sponsored") => {
    setTarget(row);
    setKind(k);
    setDays(30);
    setNotes("");
  };

  const submitPromote = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_promote_service", {
      _service_id: target.id,
      _kind: kind,
      _days: days,
      _notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Service marked as ${kind} for ${days} days`);
    setTarget(null);
    load();
  };

  const removePromotion = async (row: ServiceRow, k: "featured" | "sponsored" | "all") => {
    if (!confirm(`Remove ${k} promotion from "${row.title}"?`)) return;
    const { error } = await supabase.rpc("admin_remove_service_promotion", {
      _service_id: row.id, _kind: k, _notes: null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Promotion removed");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <Heading level={1} >Service Promotions</Heading>
        <p className="text-description-sm text-muted-foreground">
          Manually mark services as Featured or Sponsored. All actions are logged.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4" />Featured</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.featured}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />Sponsored</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.sponsored}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total services</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search service or provider…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="sponsored">Sponsored</TabsTrigger>
            <TabsTrigger value="none">Not promoted</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} />
        </Tabs>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState title="No services" description="No services match the current filters." />
      ) : (
        <div className="rounded-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Service</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Promotions</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const featured = r.is_featured && isLive(r.featured_until);
                const sponsored = r.is_sponsored && isLive(r.sponsored_until);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.title}</td>
                    <td className="p-3 text-muted-foreground">{r.vendor?.display_name ?? "—"}</td>
                    <td className="p-3 space-y-1">
                      {featured && (
                        <Badge variant="default" className="mr-2">
                          <Star className="h-3 w-3 mr-1" /> Featured · until {fmtDate(r.featured_until)}
                        </Badge>
                      )}
                      {sponsored && (
                        <Badge variant="secondary">
                          <Sparkles className="h-3 w-3 mr-1" /> Sponsored · until {fmtDate(r.sponsored_until)}
                        </Badge>
                      )}
                      {!featured && !sponsored && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openPromote(r, "featured")}>
                          <Star className="h-3 w-3 mr-1" />{featured ? "Extend featured" : "Mark featured"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openPromote(r, "sponsored")}>
                          <Sparkles className="h-3 w-3 mr-1" />{sponsored ? "Extend sponsored" : "Mark sponsored"}
                        </Button>
                        {(featured || sponsored) && (
                          <Button size="sm" variant="ghost" onClick={() => removePromotion(r, "all")}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote service</DialogTitle>
            <DialogDescription>
              {target?.title} — {target?.vendor?.display_name ?? "Unknown provider"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Promotion type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "featured" | "sponsored")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="sponsored">Sponsored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" min={1} max={365} value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
              <p className="text-xs text-muted-foreground mt-1">
                If already promoted, time is added on top of the current end date.
              </p>
            </div>
            <div>
              <Label>Internal notes (optional)</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submitPromote} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Apply promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}