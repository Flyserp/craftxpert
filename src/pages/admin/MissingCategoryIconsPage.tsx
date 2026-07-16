import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Search, Check, RefreshCcw, LayoutGrid } from "lucide-react";
import {
  LUCIDE_ICON_OPTIONS,
  ICON_LOOKUP,
  getCategoryIcon,
  isCategoryIconMissing,
} from "@/lib/categoryIcons";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  source: "service_categories" | "service_subcategories";
  parentName?: string | null;
}

export default function MissingCategoryIconsPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [iconQuery, setIconQuery] = useState("");
  const [pickedIcon, setPickedIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [catsRes, subsRes] = await Promise.all([
      supabase.from("service_categories").select("id, name, icon").order("name"),
      supabase
        .from("service_subcategories")
        .select("id, name, icon, category_id, service_categories(name)")
        .order("name"),
    ]);
    const cats: CategoryRow[] = (catsRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      source: "service_categories",
    }));
    const subs: CategoryRow[] = (subsRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      source: "service_subcategories",
      parentName: s.service_categories?.name ?? null,
    }));
    setRows([...cats, ...subs]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const missing = useMemo(
    () => rows.filter((r) => isCategoryIconMissing(r.icon, r.name)),
    [rows]
  );

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(missing, 20);

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_OPTIONS;
    return LUCIDE_ICON_OPTIONS.filter((o) => o.name.toLowerCase().includes(q));
  }, [iconQuery]);

  const openEditor = (row: CategoryRow) => {
    setEditing(row);
    setPickedIcon(row.icon && ICON_LOOKUP[row.icon] ? row.icon : null);
    setIconQuery("");
  };

  const saveIcon = async () => {
    if (!editing || !pickedIcon) return;
    setSaving(true);
    const { error } = await supabase
      .from(editing.source)
      .update({ icon: pickedIcon })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update icon", { description: error.message });
      return;
    }
    toast.success(`Icon updated for "${editing.name}"`);
    setEditing(null);
    setPickedIcon(null);
    await fetchAll();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1}  className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Missing Category Icons
          </Heading>
          <p className="text-fs-sm text-muted-foreground mt-1">
            Categories and subcategories that have no icon set, or reference an unknown
            icon name. Pick a Lucide icon below to fix each one.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {loading ? (
        <div className="rounded-lg border border-border p-8 text-center text-fs-sm text-muted-foreground">
          Loading…
        </div>
      ) : missing.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-fs-sm font-medium text-heading">All categories have valid icons.</p>
          <p className="text-fs-xs text-muted-foreground mt-1">Total scanned: {rows.length}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-fs-sm">
            <thead className="bg-muted/40 text-left text-fs-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stored value</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={`${row.source}-${row.id}`} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-heading">
                    {row.name}
                    {row.parentName && (
                      <span className="text-fs-xs text-muted-foreground ml-2">
                        in {row.parentName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.source === "service_categories" ? "Category" : "Subcategory"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-fs-xs">
                    {row.icon ?? <span className="italic">null</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEditor(row)} className="gap-2">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Set icon
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setPage}
              pageSize={pageSize}
          onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pick an icon for "{editing?.name}"</DialogTitle>
            <DialogDescription>
              Search and select a Lucide icon. The chosen icon name will be saved to the
              {editing?.source === "service_subcategories" ? " subcategory" : " category"}.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search icons (e.g. snowflake, wrench, droplet)"
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto grid grid-cols-6 sm:grid-cols-8 gap-2 p-1">
            {filteredIcons.map(({ name, icon: Icon }) => {
              const selected = pickedIcon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPickedIcon(name)}
                  title={name}
                  className={`flex flex-col items-center gap-1 p-2 rounded-sm border transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] truncate w-full text-center text-muted-foreground">
                    {name}
                  </span>
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <p className="col-span-full text-center text-fs-sm text-muted-foreground py-6">
                No icons match "{iconQuery}".
              </p>
            )}
          </div>

          {pickedIcon && (
            <div className="flex items-center gap-3 rounded-sm border border-border bg-muted/30 p-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {(() => {
                  const Icon = getCategoryIcon(pickedIcon);
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="text-fs-sm">
                <p className="font-medium text-heading">{pickedIcon}</p>
                <p className="text-fs-xs text-muted-foreground">Preview</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveIcon} disabled={!pickedIcon || saving}>
              {saving ? "Saving…" : "Save icon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
