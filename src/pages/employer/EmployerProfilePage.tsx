import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ProfileCompletion from "@/components/profile/ProfileCompletion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Camera, Save, Building2, Globe, MapPin, Factory, FileText,
  ShieldCheck, ShieldAlert, Clock, Briefcase, Users, ChevronRight, Loader2,
} from "lucide-react";
import { Heading } from "@/components/ui/app";
import VerificationTimeline from "@/components/employer/VerificationTimeline";

type EmployerProfile = {
  company_name: string | null;
  description: string | null;
  address: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
};

const INDUSTRIES = [
  "Construction", "Cleaning", "Hospitality", "Retail", "Logistics",
  "Healthcare", "Education", "Technology", "Manufacturing", "Other",
];

export default function EmployerProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EmployerProfile>({
    company_name: "", description: "", address: "", industry: "",
    website: "", logo_url: null, verification_status: "pending",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ jobs: 0, hires: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("employer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setForm(data as EmployerProfile);

      const [jobs, hires] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
        supabase.from("task_proposals").select("vendor_id").eq("customer_id", user.id).eq("status", "accepted"),
      ]);
      const uniqueVendors = new Set((hires.data || []).map((p: any) => p.vendor_id));
      setStats({ jobs: jobs.count || 0, hires: uniqueVendors.size });
      setLoading(false);
    })();
  }, [user]);

  const upsert = async (patch: Partial<EmployerProfile>) => {
    if (!user) return;
    const { error } = await supabase
      .from("employer_profiles")
      .upsert({ user_id: user.id, ...form, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert({});
      toast.success("Company profile updated");
    } catch {
      toast.error("Could not save changes");
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("tenant-logos").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("tenant-logos").getPublicUrl(path);
    try {
      await upsert({ logo_url: data.publicUrl });
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo updated");
    } catch {
      toast.error("Could not save logo");
    }
    setUploading(false);
  };

  const verification = {
    pending:  { Icon: Clock, label: "Pending review", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    verified: { Icon: ShieldCheck, label: "Verified", cls: "bg-primary/10 text-primary" },
    rejected: { Icon: ShieldAlert, label: "Verification rejected", cls: "bg-destructive/10 text-destructive" },
  }[form.verification_status];

  if (loading) {
    return (
      <DashboardLayout title="Company Profile" subtitle="Loading…">
        <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Company Profile" subtitle="Manage your company branding and verification.">
      <div className="max-w-3xl space-y-6">
        <ProfileCompletion
          checks={[
            { label: "Logo", done: !!form.logo_url },
            { label: "Company name", done: !!form.company_name?.trim() },
            { label: "Industry", done: !!form.industry?.trim() },
            { label: "Address", done: !!form.address?.trim() },
            { label: "Website", done: !!form.website?.trim() },
            { label: "Description", done: !!form.description?.trim() },
          ]}
        />
        {/* Logo + verification */}
        <section className="bg-card border border-border rounded-sm p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded-sm object-cover ring-1 ring-border" />
              ) : (
                <div className="w-20 h-20 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-sm bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:opacity-90"
                aria-label="Change logo"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div className="flex-1">
              <p className="text-fs-base font-semibold text-heading">{form.company_name || "Your company"}</p>
              <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-sm text-fs-xs font-medium ${verification.cls}`}>
                <verification.Icon className="w-3.5 h-3.5" /> {verification.label}
              </span>
            </div>
          </div>
        </section>

        {/* Verification progress timeline */}
        {user && <VerificationTimeline userId={user.id} limit={6} />}

        {/* Details */}
        <section className="bg-card border border-border rounded-sm p-6 space-y-4">
          <Heading level={2} >Company details</Heading>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Company Name" icon={Building2}>
              <Input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Acme Inc." />
            </Field>
            <Field label="Industry" icon={Factory}>
              <select
                value={form.industry || ""}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full h-10 px-3 rounded-sm border border-input bg-background text-fs-sm"
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Address" icon={MapPin} full>
              <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, city, country" />
            </Field>
            <Field label="Website" icon={Globe} full>
              <Input type="url" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" />
            </Field>
            <Field label="Description" icon={FileText} full>
              <Textarea rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell providers about your company…" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { to: "/post-task", icon: Briefcase, label: "Posted Jobs", value: stats.jobs },
            { to: "/my-bookings", icon: Users, label: "Hired Providers", value: stats.hires },
          ].map((s) => (
            <button
              key={s.to}
              type="button"
              onClick={() => navigate(s.to)}
              className="bg-card border border-border rounded-sm p-4 text-left hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <s.icon className="w-4 h-4 text-primary" />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-fs-xl font-bold text-heading">{s.value}</p>
              <p className="text-fs-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, icon: Icon, full, children }: { label: string; icon: any; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" /> {label}</Label>
      {children}
    </div>
  );
}