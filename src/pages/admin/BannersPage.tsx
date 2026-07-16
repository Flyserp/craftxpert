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
import { Plus, Pencil, Trash2, Image as ImageIcon, ExternalLink, GalleryHorizontal } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  placement: string;
  category_id: string | null;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

interface CategoryOption { id: string; name: string }

const PLACEMENTS = [
  { value: "homepage", label: "Homepage" },
  { value: "category", label: "Category Page" },
  { value: "promo", label: "Promotional" },
  { value: "sidebar", label: "Sidebar" },
  { value: "footer", label: "Footer" },
];

const emptyForm = {
  title: "",
  description: "",
  image_url: "",
  link_url: "",
  placement: "homepage",
  category_id: "",
  position: 0,
  is_active: true,
  starts_at: "",
  ends_at: "",
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: b, error }, { data: cats }] = await Promise.all([
      (supabase as any).from("banners").select("*").order("placement").order("position").order("created_at", { ascending: false }),
      supabase.from("service_categories").select("id,name").order("name"),
    ]);
    if (error) toast.error(error.message);
    setBanners((b as Banner[]) || []);
    setCategories((cats as CategoryOption[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({
      title: b.title,
      description: b.description || "",
      image_url: b.image_url || "",
      link_url: b.link_url || "",
      placement: b.placement,
      category_id: b.category_id || "",
      position: b.position,
      is_active: b.is_active,
      starts_at: toLocalInput(b.starts_at),
      ends_at: toLocalInput(b.ends_at),
    });
    setDialogOpen(true);
  };

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `banners/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    toast.success("Image uploaded");
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.image_url.trim()) return toast.error("Image is required");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim() || null,
      placement: form.placement,
      category_id: form.placement === "category" && form.category_id ? form.category_id : null,
      position: Number(form.position) || 0,
      is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    const q = (supabase as any).from("banners");
    const { error } = editingId ? await q.update(payload).eq("id", editingId) : await q.insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Banner updated" : "Banner created");
    setDialogOpen(false);
    fetchData();
  };

  const toggle = async (b: Banner) => {
    const { error } = await (supabase as any).from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    fetchData();
  };

  const remove = async (b: Banner) => {
    if (!confirm(`Delete "${b.title}"?`)) return;
    const { error } = await (supabase as any).from("banners").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Banner deleted");
    fetchData();
  };

  const scheduleLabel = (b: Banner) => {
    const now = new Date();
    if (b.starts_at && new Date(b.starts_at) > now) return { text: "Scheduled", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
    if (b.ends_at && new Date(b.ends_at) < now) return { text: "Expired", tone: "bg-muted text-muted-foreground" };
    return { text: "Live", tone: "bg-accent/20 text-foreground" };
  };

  const placementLabel = (v: string) => PLACEMENTS.find((p) => p.value === v)?.label || v;

  return (
    <AdminPage
      title="Banners"
      subtitle="Manage homepage, category, and promotional banners with scheduling and visibility controls."
      actions={
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> New Banner
        </Button>
      }
    >
      {loading ? (
        <LoadingState variant="section" />
      ) : banners.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontal}
          title="No banners yet"
          description="Add your first banner to promote categories, sales, or announcements."
          actionLabel="New Banner"
          onAction={openCreate}
        />
      ) : (
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banner</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((b) => {
                const sched = scheduleLabel(b);
                const cat = b.category_id ? categories.find((c) => c.id === b.category_id)?.name : null;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="w-16 h-10 rounded-sm object-cover border border-border" />
                        ) : (
                          <div className="w-16 h-10 rounded-sm bg-muted flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[240px]">{b.title}</p>
                          {b.link_url && (
                            <a href={b.link_url} target="_blank" rel="noreferrer" className="text-fs-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1 truncate max-w-[240px]">
                              {b.link_url} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{placementLabel(b.placement)}</Badge>
                      {cat && <div className="text-fs-xs text-muted-foreground mt-0.5">{cat}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-fs-xs ${sched.tone}`}>{sched.text}</span>
                      <div className="text-fs-xs text-muted-foreground mt-0.5">
                        {b.starts_at ? new Date(b.starts_at).toLocaleDateString() : "Anytime"} → {b.ends_at ? new Date(b.ends_at).toLocaleDateString() : "No end"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.position}</TableCell>
                    <TableCell><Switch checked={b.is_active} onCheckedChange={() => toggle(b)} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <DialogTitle>{editingId ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Summer sale" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short caption" />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex items-center gap-2">
                <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…/banner.jpg" />
                <Input type="file" accept="image/*" className="max-w-[180px]" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              </div>
              {form.image_url && <img src={form.image_url} alt="" className="mt-2 max-h-32 rounded-sm border border-border object-cover" />}
            </div>
            <div className="space-y-2">
              <Label>Click-through URL</Label>
              <Input value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="https://…/landing" />
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
                <Label>Position</Label>
                <Input type="number" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))} />
              </div>
            </div>
            {form.placement === "category" && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <p className="font-medium">Visible</p>
                <p className="text-fs-xs text-muted-foreground">Hidden banners don't render on the public site.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save banner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}