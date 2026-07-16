import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, CreditCard, Paperclip, X, FileText, Save, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";

const JOB_POSTING_FEE = 10; // USD per job

interface Category { id: string; name: string }
interface Payment {
  id: string;
  task_id: string | null;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  task?: { title: string; status: string; payment_status: string } | null;
}

const statusTone: Record<string, string> = {
  paid: "bg-accent text-accent-foreground",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const statusIcon: Record<string, JSX.Element> = {
  paid: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  refunded: <XCircle className="h-3 w-3" />,
};

export default function EmployerPostJobPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    category_id: "",
    budget_min: "",
    budget_max: "",
    preferred_date: "",
    payment_method: "stripe",
    experience_level: "" as "" | "entry" | "intermediate" | "expert",
    visibility: "public" as "public" | "private",
    featured: false,
    skills_input: "",
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: cats }, { data: pays }, { data: draft }] = await Promise.all([
      supabase.from("service_categories").select("id, name").order("name"),
      (supabase as any)
        .from("task_payments")
        .select("id, task_id, amount, payment_method, status, created_at, task:tasks(title, status, payment_status)")
        .eq("employer_id", user.id)
        .order("created_at", { ascending: false }),
      (supabase as any).from("task_drafts").select("payload").eq("user_id", user.id).maybeSingle(),
    ]);
    setCategories((cats ?? []) as Category[]);
    setPayments((pays ?? []) as Payment[]);
    if (draft?.payload) {
      setHasDraft(true);
      setForm((f) => ({ ...f, ...(draft.payload.form ?? {}) }));
      setAttachments(draft.payload.attachments ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} > 10MB`); continue; }
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("task-photos").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const saveDraft = async () => {
    if (!user) return;
    setSavingDraft(true);
    const { error } = await (supabase as any)
      .from("task_drafts")
      .upsert({ user_id: user.id, payload: { form, attachments } }, { onConflict: "user_id" });
    setSavingDraft(false);
    if (error) return toast.error(error.message);
    setHasDraft(true);
    toast.success("Draft saved");
  };

  const discardDraft = async () => {
    if (!user) return;
    await (supabase as any).from("task_drafts").delete().eq("user_id", user.id);
    setHasDraft(false);
    setForm({
      title: "", description: "", address: "", category_id: "",
      budget_min: "", budget_max: "", preferred_date: "", payment_method: "stripe",
      experience_level: "", visibility: "public", featured: false, skills_input: "",
    });
    setAttachments([]);
    toast.success("Draft discarded");
  };

  const parseSkills = (s: string) =>
    s.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);

  const postAndPay = async () => {
    if (!user) return;
    if (!form.title || !form.description || !form.address || !form.category_id) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create payment record (pending)
      const { data: pay, error: payErr } = await (supabase as any)
        .from("task_payments")
        .insert({
          employer_id: user.id,
          amount: JOB_POSTING_FEE,
          payment_method: form.payment_method,
          status: "pending",
        })
        .select()
        .single();
      if (payErr) throw payErr;

      // 2. Simulate payment success (replace with Stripe/PayPal call)
      await new Promise((r) => setTimeout(r, 600));
      const paymentOk = true;

      if (!paymentOk) {
        await (supabase as any).from("task_payments").update({ status: "failed" }).eq("id", pay.id);
        throw new Error("Payment failed");
      }

      // 3. Create job with payment_status='paid' and status='open'
      const { data: task, error: taskErr } = await (supabase as any)
        .from("tasks")
        .insert({
          customer_id: user.id,
          category_id: form.category_id,
          title: form.title,
          description: form.description,
          address: form.address,
          budget_min: form.budget_min ? Number(form.budget_min) : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          preferred_date: form.preferred_date || null,
          photos: attachments,
          skills: parseSkills(form.skills_input),
          experience_level: form.experience_level || null,
          visibility: form.visibility,
          featured: form.featured,
          status: "open",
          payment_status: "paid",
          posting_fee: JOB_POSTING_FEE,
        })
        .select()
        .single();
      if (taskErr) throw taskErr;

      // 4. Link payment to task and mark paid
      await (supabase as any)
        .from("task_payments")
        .update({ status: "paid", task_id: task.id, reference: `JOB-${task.id.slice(0,8).toUpperCase()}` })
        .eq("id", pay.id);

      // 5. Clear any saved draft
      await (supabase as any).from("task_drafts").delete().eq("user_id", user.id);
      setHasDraft(false);

      toast.success("Job published");
      setForm({
        title: "", description: "", address: "", category_id: "",
        budget_min: "", budget_max: "", preferred_date: "", payment_method: "stripe",
        experience_level: "", visibility: "public", featured: false, skills_input: "",
      });
      setAttachments([]);
      loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Post a Job"
      subtitle={`Publish a job listing — $${JOB_POSTING_FEE} per posting.`}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="desc">Description *</Label>
              <Textarea id="desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Category *</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="address">Location *</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bmin">Budget min</Label>
                <Input id="bmin" type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bmax">Budget max</Label>
                <Input id="bmax" type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} />
              </div>
              <div>
                <Label>Experience level</Label>
                <Select value={form.experience_level} onValueChange={(v: any) => setForm({ ...form, experience_level: v })}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — visible to all providers</SelectItem>
                    <SelectItem value="private">Private — invited providers only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="skills">Required skills</Label>
                <Input id="skills" placeholder="e.g. plumbing, electrical, tiling" value={form.skills_input} onChange={(e) => setForm({ ...form, skills_input: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated. Up to 20.</p>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between rounded-sm border p-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Feature this job</div>
                    <div className="text-xs text-muted-foreground">Highlighted at the top of the job feed.</div>
                  </div>
                </div>
                <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Payment method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Credit / Debit card (Stripe)</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="wallet">Wallet balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="files">Attachments</Label>
                <Input id="files" type="file" multiple accept="image/*,application/pdf" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
                {attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachments.map((url, i) => (
                      <li key={url} className="flex items-center justify-between text-xs rounded-sm border p-2">
                        <span className="flex items-center gap-1 truncate"><Paperclip className="h-3 w-3" />{url.split("/").pop()}</span>
                        <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-sm border bg-muted/40 p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">Posting fee</div>
                <div className="text-muted-foreground">Charged once when the job is published.</div>
              </div>
              <div className="text-xl font-semibold">${JOB_POSTING_FEE.toFixed(2)}</div>
            </div>

            <Button onClick={postAndPay} disabled={submitting} className="w-full">
              <CreditCard className="h-4 w-4 mr-2" />
              {submitting ? "Processing payment…" : `Pay $${JOB_POSTING_FEE} & Publish Job`}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={saveDraft} disabled={savingDraft}>
                <Save className="h-4 w-4 mr-2" />
                {savingDraft ? "Saving…" : hasDraft ? "Update draft" : "Save as draft"}
              </Button>
              {hasDraft && (
                <Button type="button" variant="ghost" onClick={discardDraft}>
                  <FileText className="h-4 w-4 mr-2" /> Discard draft
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState />
            ) : payments.length === 0 ? (
              <EmptyState title="No payments yet" description="Your job posting payments will appear here." />
            ) : (
              <ul className="space-y-3">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-sm border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">
                        {p.task?.title ?? "Unlinked posting"}
                      </div>
                      <Badge className={statusTone[p.status] ?? "bg-muted"}>
                        <span className="flex items-center gap-1">{statusIcon[p.status]}{p.status}</span>
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(p.created_at).toLocaleString()}</span>
                      <span className="font-medium text-foreground">${Number(p.amount).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground capitalize">{p.payment_method}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
