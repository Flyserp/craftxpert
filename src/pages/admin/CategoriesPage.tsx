import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Layers, Plus, Pencil, Trash2, FolderTree, GripVertical, Search, X } from "lucide-react";
import { IconPicker } from "@/components/admin/IconPicker";
import { getCategoryIcon, ICON_LOOKUP } from "@/lib/categoryIcons";
import { invalidateTaxonomy } from "@/lib/taxonomyCache";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Heading, LoadingState } from "@/components/ui/app";
import TaxonomyVisibilityCheck from "@/components/taxonomy/TaxonomyVisibilityCheck";
import CategoryAutocomplete from "@/components/admin/CategoryAutocomplete";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}
interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Persist new order to DB
const persistOrder = async (
  table: "service_categories" | "service_subcategories",
  ordered: { id: string }[]
) => {
  const updates = ordered.map((row, idx) =>
    supabase.from(table).update({ sort_order: idx }).eq("id", row.id)
  );
  const results = await Promise.all(updates);
  const err = results.find((r) => r.error)?.error;
  if (err) toast.error(`Failed to save order: ${err.message}`);
  else invalidateTaxonomy(table);
};

// ---------- Sortable category row ----------
function SortableCategoryItem({
  cat, subCount, active, onSelect, onEdit, onDelete,
}: {
  cat: Category;
  subCount: number;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="group">
      <div
        className={`w-full flex items-center gap-1 pr-2 rounded-lg transition-colors ${
          active ? "bg-primary/10" : "hover:bg-muted/50"
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="px-1.5 py-2 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onSelect}
          className={`flex-1 flex items-center gap-2 py-2 text-fs-sm text-left ${
            active ? "text-primary font-medium" : "text-body"
          }`}
        >
          {(() => {
            const Icon = ICON_LOOKUP[cat.icon ?? ""] ?? null;
            return Icon ? <Icon className="w-4 h-4 shrink-0" /> : null;
          })()}
          <span className="flex-1 truncate">{cat.name}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{subCount}</span>
        </button>
      </div>
      {active && (
        <div className="flex gap-1 px-3 py-1">
          <Button variant="ghost" size="sm" className="text-fs-xs gap-1" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-fs-xs gap-1 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------- Sortable subcategory row ----------
function SortableSubRow({
  sub, onEdit, onDelete,
}: {
  sub: Subcategory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sub.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
    >
      <td className="py-3 pl-3 pr-1 w-8">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="py-3 px-5 text-heading font-medium">
        <span className="inline-flex items-center gap-2">
          {(() => {
            const Icon = ICON_LOOKUP[sub.icon ?? ""] ?? null;
            return Icon ? <Icon className="w-4 h-4 text-primary" /> : null;
          })()}
          {sub.name}
        </span>
      </td>
      <td className="py-3 px-5 text-fs-xs font-mono text-muted-foreground">{sub.slug}</td>
      <td className="py-3 px-5 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="gap-1 text-fs-xs" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 gap-1 text-fs-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>("");

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("");

  const [subOpen, setSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState("");
  const [subIcon, setSubIcon] = useState("");
  const [subCatId, setSubCatId] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{ kind: "category" | "subcategory"; id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const [cR, sR] = await Promise.all([
      supabase.from("service_categories").select("*").order("sort_order").order("name"),
      supabase.from("service_subcategories").select("*").order("sort_order").order("name"),
    ]);
    const c = (cR.data as Category[]) || [];
    setCats(c);
    setSubs((sR.data as Subcategory[]) || []);
    if (!selectedCatId && c.length > 0) setSelectedCatId(c[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const matchingSubCatIds = useMemo(() => {
    if (!q) return new Set<string>();
    return new Set(
      subs.filter((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
          .map((s) => s.category_id)
    );
  }, [subs, q]);

  const filteredCats = useMemo(() => {
    if (!q) return cats;
    return cats.filter(
      (c) => c.name.toLowerCase().includes(q) || matchingSubCatIds.has(c.id),
    );
  }, [cats, q, matchingSubCatIds]);

  const filteredSubs = useMemo(
    () =>
      subs.filter(
        (s) =>
          s.category_id === selectedCatId &&
          (!q || s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)),
      ),
    [subs, selectedCatId, q],
  );

  const { page: categoryPage, setPage: setCategoryPage, totalPages: categoryTotalPages, totalItems: categoryTotalItems, pageItems: paginatedCats, pageSize: categoryPageSize, setPageSize: setCategoryPageSize } = usePagination(filteredCats, 12);
  const { page: subcategoryPage, setPage: setSubcategoryPage, totalPages: subcategoryTotalPages, totalItems: subcategoryTotalItems, pageItems: paginatedSubs, pageSize: subcategoryPageSize, setPageSize: setSubcategoryPageSize } = usePagination(filteredSubs, 12);

  useEffect(() => {
    setSubcategoryPage(1);
  }, [selectedCatId, setSubcategoryPage]);

  useEffect(() => {
    setCategoryPage(1);
    setSubcategoryPage(1);
  }, [q, setCategoryPage, setSubcategoryPage]);

  const handleCatDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id === active.id);
    const newIdx = cats.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(cats, oldIdx, newIdx);
    setCats(reordered);
    persistOrder("service_categories", reordered);
  };

  const handleSubDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredSubs.findIndex((s) => s.id === active.id);
    const newIdx = filteredSubs.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reorderedFiltered = arrayMove(filteredSubs, oldIdx, newIdx);
    // Merge new order back into the full subs array
    const others = subs.filter((s) => s.category_id !== selectedCatId);
    setSubs([...others, ...reorderedFiltered]);
    persistOrder("service_subcategories", reorderedFiltered);
  };

  const openNewCat = () => {
    setEditingCat(null);
    setCatName(""); setCatIcon("");
    setCatOpen(true);
  };
  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCatName(c.name); setCatIcon(c.icon || "");
    setCatOpen(true);
  };
  const saveCat = async () => {
    if (!catName.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const payload = { name: catName.trim(), icon: catIcon.trim() || null };
    const op = editingCat
      ? supabase.from("service_categories").update(payload).eq("id", editingCat.id)
      : supabase.from("service_categories").insert({ ...payload, sort_order: cats.length });
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    invalidateTaxonomy("service_categories");
    toast.success(editingCat ? "Category updated" : "Category created");
    setCatOpen(false);
    load();
  };

  const openNewSub = () => {
    if (!selectedCatId) { toast.error("Select a category first"); return; }
    setEditingSub(null);
    setSubName(""); setSubIcon(""); setSubCatId(selectedCatId);
    setSubOpen(true);
  };
  const openEditSub = (s: Subcategory) => {
    setEditingSub(s);
    setSubName(s.name); setSubIcon(s.icon || ""); setSubCatId(s.category_id);
    setSubOpen(true);
  };
  const saveSub = async () => {
    if (!subName.trim() || !subCatId) { toast.error("Name and category required"); return; }
    setSaving(true);
    const payload = {
      name: subName.trim(),
      slug: slugify(subName),
      icon: subIcon.trim() || null,
      category_id: subCatId,
    };
    const op = editingSub
      ? supabase.from("service_subcategories").update(payload).eq("id", editingSub.id)
      : supabase.from("service_subcategories").insert({ ...payload, sort_order: filteredSubs.length });
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    invalidateTaxonomy("service_subcategories");
    toast.success(editingSub ? "Subcategory updated" : "Subcategory created");
    setSubOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const table = confirmDelete.kind === "category" ? "service_categories" : "service_subcategories";
    const { error } = await supabase.from(table).delete().eq("id", confirmDelete.id);
    if (error) { toast.error(error.message); return; }
    invalidateTaxonomy(table as "service_categories" | "service_subcategories");
    toast.success("Deleted");
    setConfirmDelete(null);
    load();
  };

  if (loading) {
    return (
      <AdminPage title="Categories">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Categories"
      subtitle="Manage service categories and subcategories. Drag the handle to reorder."
      actions={
        <div className="flex gap-2">
          <CategoryAutocomplete
            categories={cats}
            subcategories={subs}
            search={search}
            onSearchChange={setSearch}
            onPickCategory={(id) => {
              setSelectedCatId(id);
              setSearch("");
            }}
            onPickSubcategory={(sub) => {
              setSelectedCatId(sub.category_id);
              setSearch(sub.name);
            }}
          />
          <Button variant="outline" size="sm" onClick={openNewCat} className="gap-1.5">
            <Plus className="w-4 h-4" /> Category
          </Button>
          <Button size="sm" onClick={openNewSub} className="gap-1.5">
            <Plus className="w-4 h-4" /> Subcategory
          </Button>
        </div>
      }
    >
      <TaxonomyVisibilityCheck variant="admin" className="mb-6" />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Categories list */}
        <section className="bg-card rounded-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <Heading level={3} >Categories</Heading>
            <span className="ml-auto text-fs-xs text-muted-foreground">{cats.length}</span>
          </div>
          {cats.length === 0 ? (
            <p className="text-description-sm p-6 text-center">No categories yet</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
              <SortableContext items={paginatedCats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="p-2">
                  {paginatedCats.map((c) => (
                    <SortableCategoryItem
                      key={c.id}
                      cat={c}
                      subCount={subs.filter((s) => s.category_id === c.id).length}
                      active={c.id === selectedCatId}
                      onSelect={() => setSelectedCatId(c.id)}
                      onEdit={() => openEditCat(c)}
                      onDelete={() => setConfirmDelete({ kind: "category", id: c.id, name: c.name })}
                    />
                  ))}
                </ul>
              </SortableContext>
              <NumberedPagination
                currentPage={categoryPage}
                totalPages={categoryTotalPages}
                totalItems={categoryTotalItems}
                pageSize={categoryPageSize}
                onPageChange={setCategoryPage}
                className="px-4 pb-4"
          onPageSizeChange={setCategoryPageSize}
              />
            </DndContext>
          )}
        </section>

        {/* Subcategories */}
        <section className="bg-card rounded-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-blue-500" />
            <Heading level={3} >
              Subcategories {selectedCatId && <span className="text-muted-foreground font-normal">in {cats.find(c=>c.id===selectedCatId)?.name}</span>}
            </Heading>
            <span className="ml-auto text-fs-xs text-muted-foreground">{filteredSubs.length}</span>
          </div>
          {filteredSubs.length === 0 ? (
            <p className="text-description-sm p-12 text-center">
              {selectedCatId ? "No subcategories — add one to get started" : "Select a category"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="w-8" />
                    <th className="text-left py-3 px-5 font-medium">Name</th>
                    <th className="text-left py-3 px-5 font-medium">Slug</th>
                    <th className="text-right py-3 px-5 font-medium">Actions</th>
                  </tr>
                </thead>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
                  <SortableContext items={paginatedSubs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {paginatedSubs.map((s) => (
                        <SortableSubRow
                          key={s.id}
                          sub={s}
                          onEdit={() => openEditSub(s)}
                          onDelete={() => setConfirmDelete({ kind: "subcategory", id: s.id, name: s.name })}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
              <NumberedPagination
                currentPage={subcategoryPage}
                totalPages={subcategoryTotalPages}
                totalItems={subcategoryTotalItems}
                pageSize={subcategoryPageSize}
                onPageChange={setSubcategoryPage}
                className="px-5 pb-5"
          onPageSizeChange={setSubcategoryPageSize}
              />
            </div>
          )}
        </section>
      </div>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Home Cleaning" />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={catIcon} onChange={(v) => setCatIcon(v ?? "")} />
              <p className="text-[11px] text-muted-foreground">
                Pick a Lucide icon. The chosen name is saved to the category.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSub ? "Edit Subcategory" : "New Subcategory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Parent Category</Label>
              <Select value={subCatId} onValueChange={setSubCatId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Deep Cleaning" />
              {subName && (
                <p className="text-[13px] text-muted-foreground">Slug: <span className="font-mono">{slugify(subName)}</span></p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={subIcon} onChange={(v) => setSubIcon(v ?? "")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button onClick={saveSub} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium">{confirmDelete?.name}</span>.
              {confirmDelete?.kind === "category" && " All its subcategories will also be removed if not in use."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
