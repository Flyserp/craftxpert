import { useEffect, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState, EmptyState } from "@/components/ui/app";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MousePointerClick, Eye, Megaphone, ExternalLink } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  placement: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  impressions: number;
  clicks: number;
  created_at: string;
}

const PLACEMENTS = [
  { value: "homepage_top", label: "Homepage — Top Banner" },
  { value: "homepage_mid", label: "Homepage — Mid Section" },
  { value: "sidebar", label: "Sidebar" },
  { value: "marketplace", label: "Marketplace Listing" },
  { value: "job_feed", label: "Job Feed" },
  { value: "footer", label: "Footer" },
];

const emptyForm = {
  title: "",
  description: "",
  image_url: "",
  link_url: "",
  placement: "homepage_top",
  starts_at: "",
  ends_at: "",
  is_active: true,
  sort_order: 0,
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function AdvertisementsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("advertisements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAds((data as Ad[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAds(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      description: ad.description || "",
      image_url: ad.image_url || "",
      link_url: ad.link_url || "",
      placement: ad.placement,
      starts_at: toLocalInput(ad.starts_at),
      ends_at: toLocalInput(ad.ends_at),
      is_active: ad.is_active,
      sort_order: ad.sort_order,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      link_url: form.link_url.trim() || null,
      placement: form.placement,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error } = editingId
      ? await supabase.from("advertisements").update(payload).eq("id", editingId)
      : await supabase.from("advertisements").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Ad updated" : "Ad created");
    setDialogOpen(false);
    fetchAds();
  };

  const toggle = async (ad: Ad) => {
    const { error } = await supabase
      .from("advertisements")
      .update({ is_active: !ad.is_active })
      .eq("id", ad.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ad ${!ad.is_active ? "enabled" : "disabled"}`);
    fetchAds();
  };

  const remove = async (ad: Ad) => {
    if (!confirm(`Delete "${ad.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("advertisements").delete().eq("id", ad.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ad deleted");
    fetchAds();
  };

  const placementLabel = (v: string) => PLACEMENTS.find((p) => p.value === v)?.label || v;
  const scheduleLabel = (ad: Ad) => {
    const now = new Date();
    if (ad.starts_at && new Date(ad.starts_at) > now) return { text: "Scheduled", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
    if (ad.ends_at && new Date(ad.ends_at) < now) return { text: "Expired", tone: "bg-muted text-muted-foreground" };
    return { text: "Live window", tone: "bg-accent/20 text-foreground" };
  };

  return (
    <AdminPage
      title="Advertisements"
      subtitle="Create, schedule, and track promotional banners across the platform."
      actions={
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> New Ad
        </Button>
      }
    >
      {loading ? (
        <LoadingState variant="section" />
      ) : ads.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No advertisements yet"
          description="Create your first ad to promote services, providers, or announcements."
          actionLabel="New Ad"
          onAction={openCreate}
        />
      ) : (
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => {
                const sched = scheduleLabel(ad);
                const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) + "%" : "—";
                return (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt="" className="w-12 h-12 rounded-sm object-cover border border-border" />
                        ) : (
                          <div className="w-12 h-12 rounded-sm bg-muted flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[220px]">{ad.title}</p>
                          {ad.link_url && (
                            <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-fs-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1 truncate max-w-[220px]">
                              {ad.link_url} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{placementLabel(ad.placement)}</Badge></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-fs-xs ${sched.tone}`}>{sched.text}</span>
                      <div className="text-fs-xs text-muted-foreground mt-0.5">
                        {ad.starts_at ? new Date(ad.starts_at).toLocaleDateString() : "Anytime"}
                        {" → "}
                        {ad.ends_at ? new Date(ad.ends_at).toLocaleDateString() : "No end"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ad.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{ad.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{ctr}</TableCell>
                    <TableCell>
                      <Switch checked={ad.is_active} onCheckedChange={() => toggle(ad)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ad)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(ad)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit advertisement" : "New advertisement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Summer promo" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short caption shown next to the image" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…/banner.jpg" />
              </div>
              <div className="space-y-2">
                <Label>Click-through URL</Label>
                <Input value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="https://…/landing" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Placement</Label>
                <Select value={form.placement} onValueChange={(v) => setForm((f) => ({ ...f, placement: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-sm border border-border p-3">
              <div>
                <p className="font-medium">Enabled</p>
                <p className="text-fs-xs text-muted-foreground">Disabled ads are hidden from the public site.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
            {editingId && (
              <div className="grid grid-cols-2 gap-3 rounded-sm border border-border bg-muted/30 p-3 text-fs-sm">
                <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Impressions: <span className="font-medium tabular-nums">{ads.find((a) => a.id === editingId)?.impressions ?? 0}</span></div>
                <div className="flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-muted-foreground" /> Clicks: <span className="font-medium tabular-nums">{ads.find((a) => a.id === editingId)?.clicks ?? 0}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save ad"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}