import { useState, useEffect } from"react";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { toast } from"sonner";
import { Plus, Pencil, Trash2, X, Check, DollarSign, Sparkles, Upload, HelpCircle, ImageIcon } from"lucide-react";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import SponsorServiceDialog from"@/components/provider/SponsorServiceDialog";
import { Heading } from "@/components/ui/app";

interface ServiceCategory {
 id: string;
 name: string;
}

interface SubCategory {
 id: string;
 name: string;
 category_id: string;
}

interface ProviderService {
 id: string;
 vendor_id: string;
 category_id: string;
 subcategory_id: string | null;
 title: string;
 description: string | null;
 price_min: number | null;
 price_max: number | null;
 price_type: string;
 is_active: boolean;
 is_sponsored?: boolean;
 sponsored_until?: string | null;
 images?: string[] | null;
 faqs?: { question: string; answer: string }[] | null;
 service_categories?: { name: string } | null;
 service_subcategories?: { name: string } | null;
}

const ServiceListManager = () => {
 const { user } = useAuth();
 const [services, setServices] = useState<ProviderService[]>([]);
 const [categories, setCategories] = useState<ServiceCategory[]>([]);
 const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState({
 category_id:"",
 subcategory_id:"",
 title:"",
 description:"",
 price_min:"",
 price_max:"",
 price_type:"hourly",
 });
 const [images, setImages] = useState<string[]>([]);
 const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
 const [uploading, setUploading] = useState(false);
 const [sponsorTarget, setSponsorTarget] = useState<ProviderService | null>(null);

 const fetchData = async () => {
 if (!user) return;
 setLoading(true);

 const [servicesRes, categoriesRes, subcatsRes] = await Promise.all([
 supabase
 .from("vendor_services")
 .select("*, service_categories(name), service_subcategories(name)")
 .eq("vendor_id", user.id)
 .order("created_at", { ascending: false }),
 supabase.from("service_categories").select("*").order("name"),
 supabase.from("service_subcategories").select("id, name, category_id").order("name"),
 ]);

 if (servicesRes.data) setServices(servicesRes.data as unknown as ProviderService[]);
 if (categoriesRes.data) setCategories(categoriesRes.data);
 if (subcatsRes.data) setSubcategories(subcatsRes.data);

 setLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, [user]);

 const resetForm = () => {
 setForm({ category_id:"", subcategory_id:"", title:"", description:"", price_min:"", price_max:"", price_type:"hourly" });
 setImages([]);
 setFaqs([]);
 setEditingId(null);
 setShowForm(false);
 };

 const handleEdit = (s: ProviderService) => {
 setForm({
 category_id: s.category_id,
 subcategory_id: s.subcategory_id ||"",
 title: s.title,
 description: s.description ||"",
 price_min: s.price_min?.toString() ||"",
 price_max: s.price_max?.toString() ||"",
 price_type: s.price_type,
 });
 setImages(Array.isArray(s.images) ? s.images : []);
 setFaqs(Array.isArray(s.faqs) ? s.faqs : []);
 setEditingId(s.id);
 setShowForm(true);
 };

 const handleSave = async () => {
 if (!user || !form.title.trim() || !form.category_id) {
 toast.error("Title and category are required");
 return;
 }

 const payload = {
 vendor_id: user.id,
 category_id: form.category_id,
 subcategory_id: form.subcategory_id || null,
 title: form.title.trim(),
 description: form.description.trim() || null,
 price_min: form.price_min ? parseFloat(form.price_min) : null,
 price_max: form.price_max ? parseFloat(form.price_max) : null,
 price_type: form.price_type,
 images,
 faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
 };

 let error;
 if (editingId) {
 ({ error } = await supabase.from("vendor_services").update(payload).eq("id", editingId));
 } else {
 ({ error } = await supabase.from("vendor_services").insert(payload));
 }

 if (error) {
 toast.error("Failed to save service");
 } else {
 toast.success(editingId ?"Service updated!" :"Service added!");
 resetForm();
 fetchData();
 }
 };

 const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
   if (!user || !e.target.files?.length) return;
   setUploading(true);
   const uploaded: string[] = [];
   for (const file of Array.from(e.target.files)) {
     if (file.size > 5 * 1024 * 1024) {
       toast.error(`${file.name} is over 5MB`);
       continue;
     }
     const path = `${user.id}/services/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
     const { error } = await supabase.storage.from("portfolio").upload(path, file, { upsert: false });
     if (error) {
       toast.error(`Upload failed: ${file.name}`);
       continue;
     }
     const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
     uploaded.push(data.publicUrl);
   }
   setImages((prev) => [...prev, ...uploaded]);
   setUploading(false);
   e.target.value = "";
 };

 const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));
 const addFaq = () => setFaqs((prev) => [...prev, { question: "", answer: "" }]);
 const updateFaq = (idx: number, field: "question" | "answer", value: string) =>
   setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
 const removeFaq = (idx: number) => setFaqs((prev) => prev.filter((_, i) => i !== idx));

 const handleDelete = async (id: string) => {
 const { error } = await supabase.from("vendor_services").delete().eq("id", id);
 if (error) {
 toast.error("Failed to delete");
 } else {
 toast.success("Service removed");
 fetchData();
 }
 };

 const toggleActive = async (id: string, isActive: boolean) => {
 await supabase.from("vendor_services").update({ is_active: !isActive }).eq("id", id);
 fetchData();
 };

  const handleSponsor = (s: ProviderService) => setSponsorTarget(s);

 const filteredSubcategories = subcategories.filter((s) => s.category_id === form.category_id);
 const { page, setPage, totalPages, totalItems, pageItems: paginatedServices, pageSize, setPageSize } = usePagination(services, 10);

 if (loading) {
 return (
 <div className="bg-card rounded-sm border border-border p-6">
 <div className="h-6 w-40 bg-muted rounded animate-pulse mb-4" />
 <div className="space-y-3">
 {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
 </div>
 </div>
 );
 }

 return (
 <>
 <div className="bg-card rounded-sm border border-border p-6">
 <div className="flex items-center justify-between mb-5">
 <Heading level={3} >Your Services</Heading>
 {!showForm && (
 <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
 <Plus className="w-4 h-4" /> Add Service
 </Button>
 )}
 </div>

 {showForm && (
 <div className="bg-muted/50 rounded-lg p-4 mb-5 border border-border/40 space-y-3">
 <div className="grid sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Category *</label>
 <select
 value={form.category_id}
 onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id:"" })}
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm"
 >
 <option value="">Select category</option>
 {categories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Subcategory</label>
 <select
 value={form.subcategory_id}
 onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
 disabled={!form.category_id || filteredSubcategories.length === 0}
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm disabled:opacity-50"
 >
 <option value="">{filteredSubcategories.length === 0 ?"No subcategories" :"Select subcategory (optional)"}</option>
 {filteredSubcategories.map((s) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Service Title *</label>
 <input
 type="text"
 value={form.title}
 onChange={(e) => setForm({ ...form, title: e.target.value })}
 placeholder="e.g. Kitchen Faucet Repair"
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm"
 />
 </div>

 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Description</label>
 <textarea
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder="Describe what this service includes..."
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm resize-none"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Min Price ($)</label>
 <input
 type="number"
 value={form.price_min}
 onChange={(e) => setForm({ ...form, price_min: e.target.value })}
 placeholder="30"
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm"
 />
 </div>
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Max Price ($)</label>
 <input
 type="number"
 value={form.price_max}
 onChange={(e) => setForm({ ...form, price_max: e.target.value })}
 placeholder="80"
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm"
 />
 </div>
 <div>
 <label className="block text-fs-xs font-medium text-heading mb-1">Price Type</label>
 <select
 value={form.price_type}
 onChange={(e) => setForm({ ...form, price_type: e.target.value })}
 className="w-full h-10 px-3 rounded-lg border border-input bg-background text-fs-sm"
 >
 <option value="hourly">Per Hour</option>
 <option value="fixed">Fixed Price</option>
 <option value="quote">Get Quote</option>
 </select>
 </div>
 </div>

  <div>
    <label className="block text-fs-xs font-medium text-heading mb-1 flex items-center gap-1.5">
      <ImageIcon className="w-3.5 h-3.5" /> Service Images
    </label>
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
      {images.map((url) => (
        <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
          <img src={url} alt="service" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => removeImage(url)}
            className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <label className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-fs-xs text-muted-foreground">
        <Upload className="w-4 h-4 mb-1" />
        {uploading ? "Uploading…" : "Add"}
        <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} className="hidden" />
      </label>
    </div>
  </div>

  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-fs-xs font-medium text-heading flex items-center gap-1.5">
        <HelpCircle className="w-3.5 h-3.5" /> FAQs
      </label>
      <Button size="sm" variant="ghost" type="button" onClick={addFaq} className="gap-1 text-fs-xs">
        <Plus className="w-3 h-3" /> Add FAQ
      </Button>
    </div>
    <div className="space-y-2">
      {faqs.map((f, i) => (
        <div key={i} className="rounded-lg border border-border/60 p-2 space-y-1.5 bg-background">
          <div className="flex gap-2">
            <input
              value={f.question}
              onChange={(e) => updateFaq(i, "question", e.target.value)}
              placeholder="Question"
              className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-fs-sm"
            />
            <Button size="icon" variant="ghost" type="button" onClick={() => removeFaq(i)} className="h-9 w-9 hover:text-destructive" aria-label="Remove FAQ">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <textarea
            value={f.answer}
            onChange={(e) => updateFaq(i, "answer", e.target.value)}
            placeholder="Answer"
            rows={2}
            className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-fs-sm resize-none"
          />
        </div>
      ))}
      {faqs.length === 0 && (
        <p className="text-fs-xs text-muted-foreground">No FAQs yet. Add common questions customers ask.</p>
      )}
    </div>
  </div>

 <div className="flex gap-2 pt-1">
 <Button size="sm" onClick={handleSave} className="gap-1.5">
 <Check className="w-4 h-4" /> {editingId ?"Update" :"Add Service"}
 </Button>
 <Button size="sm" variant="ghost" onClick={resetForm} className="gap-1.5">
 <X className="w-4 h-4" /> Cancel
 </Button>
 </div>
 </div>
 )}

 {services.length === 0 ? (
 <div className="text-center py-8 text-fs-sm text-muted-foreground">
 <DollarSign className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
 No services yet. Add your first service to start receiving bookings.
 </div>
 ) : (
 <>
 <div className="space-y-3">
 {paginatedServices.map((s) => (
 <div
 key={s.id}
 className={`rounded-lg border p-4 transition-all duration-200 ${
 s.is_active ?"border-border/60 bg-background" :"border-border/30 bg-muted/30 opacity-60"
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <Heading level={4} >{s.title}</Heading>
 <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
 s.is_active ?"bg-secondary text-secondary-foreground" :"bg-muted text-muted-foreground"
 }`}>
 {s.is_active ?"Active" :"Paused"}
 </span>
                  {s.is_sponsored && s.sponsored_until && new Date(s.sponsored_until) > new Date() && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-primary inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Sponsored · until {new Date(s.sponsored_until).toLocaleDateString()}
                    </span>
                  )}
 </div>
 <p className="text-fs-xs text-muted-foreground mb-1">
 {(s.service_categories as any)?.name ||"Uncategorized"}
 {(s.service_subcategories as any)?.name && (
 <span> · {(s.service_subcategories as any).name}</span>
 )}
 </p>
 {s.description && (
 <p className="text-fs-xs text-body line-clamp-2">{s.description}</p>
 )}
 {(s.price_min || s.price_max) && (
 <p className="text-fs-xs font-medium text-heading mt-1.5">
 ${s.price_min ||"—"}–${s.price_max ||"—"} / {s.price_type ==="hourly" ?"hr" : s.price_type}
 </p>
 )}
 </div>

 <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={s.is_sponsored ? "Extend sponsorship" : "Sponsor this service"}
                    aria-label={s.is_sponsored ? `Extend sponsorship for ${s.title}` : `Sponsor ${s.title}`}
                    onClick={() => handleSponsor(s)}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${s.is_sponsored ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleActive(s.id, s.is_active)} aria-label={s.is_active ? `Pause ${s.title}` : `Activate ${s.title}`}>
 {s.is_active ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <Check className="w-3.5 h-3.5 text-primary" />}
 </Button>
 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(s)} aria-label={`Edit ${s.title}`}>
 <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
 </Button>
 <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.title}`}>
 <Trash2 className="w-3.5 h-3.5" />
 </Button>
 </div>
 </div>
 </div>
 ))}
 </div>
 <NumberedPagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 pageSize={pageSize}
 onPageChange={setPage}
 onPageSizeChange={setPageSize}
 />
 </>
 )}
 </div>
  <SponsorServiceDialog
    open={!!sponsorTarget}
    serviceId={sponsorTarget?.id ?? null}
    serviceTitle={sponsorTarget?.title}
    currentSponsoredUntil={sponsorTarget?.sponsored_until ?? null}
    onClose={() => setSponsorTarget(null)}
    onDone={fetchData}
  />
  </>
 );
};

export default ServiceListManager;
