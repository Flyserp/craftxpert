import { useState, useEffect, useRef } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText, Plus, Pencil, Trash2, Eye, GripVertical, ExternalLink,
  Sparkles, Bold, Italic, List, Link as LinkIcon, Heading2,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { Heading } from "@/components/ui/app";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  title: "",
  slug: "",
  content: "",
  status: "draft",
  meta_title: "",
  meta_description: "",
  og_image: "",
};

const DEFAULT_PAGES: Array<{ title: string; slug: string; content: string; meta_description: string }> = [
  { title: "About Us", slug: "about", meta_description: "Learn more about our mission and team.", content: "# About Us\n\nWelcome to our platform. We connect customers with trusted professionals.\n\n## Our Mission\n\nMake hiring quality service providers simple, fast, and reliable." },
  { title: "Contact", slug: "contact", meta_description: "Get in touch with our team.", content: "# Contact\n\nWe'd love to hear from you.\n\n- **Email:** support@example.com\n- **Phone:** +1 (555) 123-4567" },
  { title: "Privacy Policy", slug: "privacy", meta_description: "How we collect, use, and protect your data.", content: "# Privacy Policy\n\n*Last updated: today*\n\n## Information we collect\n\nWe collect information you provide directly to us.\n\n## How we use it\n\nTo deliver and improve our services." },
  { title: "Terms of Service", slug: "terms", meta_description: "Terms governing the use of our platform.", content: "# Terms of Service\n\n## Acceptance\n\nBy using the platform you agree to these terms.\n\n## Conduct\n\nUse the service lawfully and respectfully." },
  { title: "FAQ", slug: "faq", meta_description: "Frequently asked questions.", content: "# FAQ\n\n## How do I book a service?\n\nBrowse providers, choose a service, and confirm the booking.\n\n## How do payments work?\n\nWe support card and PayPal." },
  { title: "Help Center", slug: "help", meta_description: "Guides and tutorials to get the most out of the platform.", content: "# Help Center\n\n## Getting started\n\nCreate an account and complete your profile.\n\n## Need more help?\n\nVisit our [Contact](/page/contact) page." },
];

export default function CmsPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<CmsPage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const { page: currentPage, setPage: setCurrentPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(pages, 15);

  const fetchPages = async () => {
    const { data } = await supabase
      .from("cms_pages")
      .select("*")
      .order("sort_order", { ascending: true });
    setPages((data as CmsPage[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (page: CmsPage) => {
    setEditingId(page.id);
    setForm({
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: page.status,
      meta_title: page.meta_title || "",
      meta_description: page.meta_description || "",
      og_image: page.og_image || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      content: form.content,
      status: form.status,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      og_image: form.og_image.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("cms_pages")
        .update(payload)
        .eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Page updated");
    } else {
      const maxOrder = pages.length > 0
        ? Math.max(...pages.map((p) => p.sort_order)) + 1
        : 0;
      const { error } = await supabase
        .from("cms_pages")
        .insert({ ...payload, sort_order: maxOrder });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Page created");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchPages();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("cms_pages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Page deleted");
    fetchPages();
  };

  const toggleStatus = async (page: CmsPage) => {
    const newStatus = page.status === "published" ? "draft" : "published";
    await supabase.from("cms_pages").update({ status: newStatus }).eq("id", page.id);
    toast.success(`Page ${newStatus === "published" ? "published" : "unpublished"}`);
    fetchPages();
  };

  const seedDefaults = async () => {
    const existing = new Set(pages.map((p) => p.slug));
    const missing = DEFAULT_PAGES.filter((p) => !existing.has(p.slug));
    if (missing.length === 0) {
      toast.info("All default pages already exist");
      return;
    }
    setSeeding(true);
    const startOrder = pages.length;
    const rows = missing.map((p, i) => ({ ...p, status: "published", sort_order: startOrder + i }));
    const { error } = await supabase.from("cms_pages").insert(rows);
    setSeeding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Created ${missing.length} default page${missing.length === 1 ? "" : "s"}`);
    fetchPages();
  };

  const wrapSelection = (before: string, after = before) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = form.content;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setForm((f) => ({ ...f, content: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  if (loading) {
    return (
      <AdminPage title="CMS Pages">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="CMS Pages"
      subtitle="Create and manage static pages like About, FAQ, Terms, and Privacy."
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={seedDefaults} disabled={seeding}>
            <Sparkles className="w-4 h-4" /> {seeding ? "Seeding…" : "Seed defaults"}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-4 h-4" /> New Page
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {pages.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm mb-4">No pages created yet</p>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create Your First Page
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Page</th>
                    <th className="text-left py-3 px-5 font-medium">Slug</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Updated</th>
                    <th className="text-right py-3 px-5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((page) => (
                    <tr key={page.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-medium text-heading">{page.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <code className="text-fs-xs bg-muted px-2 py-0.5 rounded">/page/{page.slug}</code>
                      </td>
                      <td className="py-3 px-5">
                        <Badge
                          variant={page.status === "published" ? "default" : "secondary"}
                          className="cursor-pointer text-[10px]"
                          onClick={() => toggleStatus(page)}
                        >
                          {page.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-muted-foreground text-fs-xs">
                        {new Date(page.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            aria-label={`Preview ${page.title}`}
                            onClick={() => { setPreviewContent(page); setPreviewOpen(true); }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            aria-label={`Edit ${page.title}`}
                            onClick={() => openEdit(page)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            aria-label={`Delete ${page.title}`}
                            onClick={() => handleDelete(page.id, page.title)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <NumberedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Page" : "Create New Page"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="About Us"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: editingId ? f.slug : slugify(title),
                    }));
                  }}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  placeholder="about-us"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-fs-xs font-semibold text-heading uppercase tracking-wide">SEO</p>
              <div className="space-y-2">
                <Label>Meta Title <span className="text-muted-foreground font-normal">(optional, falls back to page title)</span></Label>
                <Input
                  placeholder="About Us | Brand"
                  value={form.meta_title}
                  onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))}
                  maxLength={70}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Input
                  placeholder="Brief page description for search engines"
                  value={form.meta_description}
                  onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label>Open Graph Image URL</Label>
                <Input
                  placeholder="https://example.com/og-image.png"
                  value={form.og_image}
                  onChange={(e) => setForm((f) => ({ ...f, og_image: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Content (Markdown)</Label>
              <div className="flex flex-wrap items-center gap-1 rounded-t-sm border border-b-0 border-border bg-muted/40 px-2 py-1.5">
                <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => wrapSelection("**")}>
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => wrapSelection("*")}>
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => wrapSelection("\n## ", "")}>
                  <Heading2 className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => wrapSelection("\n- ", "")}>
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => wrapSelection("[", "](https://)")}>
                  <LinkIcon className="w-3.5 h-3.5" />
                </Button>
                <span className="text-fs-xs text-muted-foreground ml-auto pr-1">Markdown</span>
              </div>
              <Textarea
                ref={contentRef}
                placeholder="# Page Title&#10;&#10;Write your content here using Markdown..."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="min-h-[300px] font-mono text-fs-sm rounded-t-none border-t-0"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Page" : "Create Page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> {previewContent?.title}
            </DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="prose dark:prose-invert max-w-none py-2">
              {previewContent.content.split("\n").map((line, i) => {
                if (line.startsWith("# ")) return <Heading level={1} key={i}>{line.slice(2)}</Heading>;
                if (line.startsWith("## ")) return <Heading level={2} key={i}>{line.slice(3)}</Heading>;
                if (line.startsWith("### ")) return <Heading level={3} key={i}>{line.slice(4)}</Heading>;
                if (line.startsWith("**") && line.endsWith("**"))
                  return <p key={i}><strong>{line.slice(2, -2)}</strong></p>;
                if (line.startsWith("- ")) return <li key={i}>{line.slice(2)}</li>;
                if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**"))
                  return <p key={i}><em>{line.slice(1, -1)}</em></p>;
                if (line.trim() === "") return <br key={i} />;
                // Handle bold within text
                const boldParsed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                return <p key={i} dangerouslySetInnerHTML={{ __html: boldParsed }} />;
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
