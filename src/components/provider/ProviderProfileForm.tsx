import { useState, useEffect, useRef, useMemo } from"react";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { toast } from"sonner";
import { Save, User, Phone, MapPin, FileText, Camera, Loader2, Briefcase, Award, Plus, X, Upload, Trash2 } from"lucide-react";
import { Link } from "react-router-dom";
import { Heading } from "@/components/ui/app";

type Certificate = { name: string; url: string; path: string };
type Category = { id: string; name: string };

const ProviderProfileForm = () => {
 const { user, profile, refreshProfile } = useAuth();
 const [loading, setLoading] = useState(false);
 const [uploadingAvatar, setUploadingAvatar] = useState(false);
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [uploadingCert, setUploadingCert] = useState(false);
 const [form, setForm] = useState({
 display_name:"",
    business_name:"",
 phone:"",
 address:"",
 bio:"",
    experience_years: "" as string,
    category_id: "",
    skills: [] as string[],
 });

 useEffect(() => {
 if (profile) {
 setForm({
 display_name: profile.display_name ||"",
        business_name: (profile as any).business_name ||"",
 phone: profile.phone ||"",
 address: profile.address ||"",
 bio: profile.bio ||"",
        experience_years: (profile as any).experience_years != null ? String((profile as any).experience_years) : "",
        category_id: (profile as any).category_id || "",
        skills: Array.isArray((profile as any).skills) ? (profile as any).skills : [],
 });
 setAvatarUrl(profile.avatar_url || null);
      const certs = (profile as any).certificates;
      setCertificates(Array.isArray(certs) ? certs : []);
 }
 }, [profile]);

  useEffect(() => {
    supabase
      .from("service_categories")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);

 const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !user) return;

 if (!file.type.startsWith("image/")) {
 toast.error("Please select an image file");
 return;
 }
 if (file.size > 5 * 1024 * 1024) {
 toast.error("Image must be under 5MB");
 return;
 }

 setUploadingAvatar(true);

 const fileExt = file.name.split(".").pop();
 const filePath =`${user.id}/avatar.${fileExt}`;

 // Upload to storage
 const { error: uploadError } = await supabase.storage
 .from("avatars")
 .upload(filePath, file, { upsert: true });

 if (uploadError) {
 toast.error("Failed to upload photo");
 setUploadingAvatar(false);
 return;
 }

 // Get public URL
 const { data: urlData } = supabase.storage
 .from("avatars")
 .getPublicUrl(filePath);

 const publicUrl =`${urlData.publicUrl}?t=${Date.now()}`;

 // Update profile
 const { error: updateError } = await supabase
 .from("profiles")
 .update({ avatar_url: publicUrl })
 .eq("user_id", user.id);

 setUploadingAvatar(false);

 if (updateError) {
 toast.error("Failed to update profile photo");
 } else {
 setAvatarUrl(publicUrl);
 toast.success("Profile photo updated!");
 }

 // Reset file input
 if (fileInputRef.current) fileInputRef.current.value ="";
 };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || form.skills.includes(v)) return;
    setForm({ ...form, skills: [...form.skills, v] });
    setSkillInput("");
  };

  const removeSkill = (s: string) =>
    setForm({ ...form, skills: form.skills.filter((x) => x !== s) });

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setUploadingCert(true);
    const path = `${user.id}/certs/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("verification-docs").upload(path, file);
    if (error) {
      toast.error("Failed to upload certificate");
      setUploadingCert(false);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("verification-docs")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const next = [...certificates, { name: file.name, url: signed?.signedUrl || "", path }];
    setCertificates(next);
    await supabase.from("profiles").update({ certificates: next as any }).eq("user_id", user.id);
    setUploadingCert(false);
    if (certInputRef.current) certInputRef.current.value = "";
    toast.success("Certificate uploaded");
  };

  const removeCertificate = async (path: string) => {
    if (!user) return;
    await supabase.storage.from("verification-docs").remove([path]);
    const next = certificates.filter((c) => c.path !== path);
    setCertificates(next);
    await supabase.from("profiles").update({ certificates: next as any }).eq("user_id", user.id);
    toast.success("Certificate removed");
  };

  const handleSave = async () => {
 if (!user) return;
 setLoading(true);

    // Provider profile is "complete" once the essentials are filled in.
    const isComplete =
      !!form.display_name.trim() &&
      !!form.phone.trim() &&
      !!form.address.trim() &&
      !!form.category_id &&
      form.skills.length > 0 &&
      !!form.experience_years;

    // Geocode address so customers can find this provider by radius.
    // Only re-geocode when the address actually changed.
    let coords: { latitude?: number | null; longitude?: number | null } = {};
    const currentAddress = (profile as any)?.address ?? "";
    if (form.address.trim() && form.address.trim() !== currentAddress.trim()) {
      const { geocodeAddress } = await import("@/lib/geo");
      const pt = await geocodeAddress(form.address);
      if (pt) coords = { latitude: pt.lat, longitude: pt.lng };
    }

 const { error } = await supabase
 .from("profiles")
 .update({
 display_name: form.display_name,
        business_name: form.business_name || null,
 phone: form.phone,
 address: form.address,
 bio: form.bio,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        category_id: form.category_id || null,
        skills: form.skills,
        ...coords,
        ...(isComplete ? { profile_completed: true } : {}),
      } as any)
 .eq("user_id", user.id);

 setLoading(false);
 if (error) {
 toast.error("Failed to update profile");
 } else {
      if (isComplete && !profile?.profile_completed) {
        await refreshProfile();
      }
 toast.success("Profile updated!");
 }
 };

  const fields = [
    { key:"display_name", label:"Display Name", icon: User, placeholder:"Your name", type:"text" },
    { key:"business_name", label:"Business Name", icon: Briefcase, placeholder:"Acme Services LLC", type:"text" },
    { key:"phone", label:"Phone Number", icon: Phone, placeholder:"+1 (555) 123-4567", type:"tel" },
    { key:"address", label:"Location / Service Area", icon: MapPin, placeholder:"Brooklyn, NY", type:"text" },
  ];

  const completion = useMemo(() => {
    const checks = [
      !!avatarUrl,
      !!form.display_name,
      !!form.business_name,
      form.skills.length > 0,
      !!form.experience_years,
      !!form.category_id,
      !!form.address,
      !!form.bio,
      certificates.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [avatarUrl, form, certificates]);

 const initials = (form.display_name ||"V").slice(0, 2).toUpperCase();

 return (
    <>
    {/* Profile completion progress */}
    <div className="bg-card rounded-sm border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <Heading level={3} >Profile Completion</Heading>
        <span className="text-fs-sm font-semibold text-primary">{completion.pct}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-sm overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${completion.pct}%` }} />
      </div>
      <p className="text-fs-xs text-muted-foreground mt-2">
        {completion.done} of {completion.total} sections complete. Complete your profile to attract more customers.
      </p>
    </div>

 <div className="bg-card rounded-sm border border-border p-6">
 <Heading level={3}  className="mb-5">Profile Information</Heading>

 {/* Avatar upload */}
 <div className="flex items-center gap-5 mb-6 pb-6 border-b border-border/40">
 <div className="relative group">
 {avatarUrl ? (
 <img
 src={avatarUrl}
 alt="Profile"
 className="w-20 h-20 rounded-sm object-cover ring-1 ring-border/50"
 />
 ) : (
 <div className="w-20 h-20 rounded-sm bg-primary/8 flex items-center justify-center text-fs-xl font-bold text-primary ring-1 ring-primary/10">
 {initials}
 </div>
 )}
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploadingAvatar}
 className="absolute inset-0 rounded-sm bg-foreground/0 group-hover:bg-foreground/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
 aria-label="Change photo"
 >
 {uploadingAvatar ? (
 <Loader2 className="w-5 h-5 text-white animate-spin" />
 ) : (
 <Camera className="w-5 h-5 text-white" />
 )}
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleAvatarUpload}
 className="hidden"
 />
 </div>
 <div>
 <p className="text-fs-sm font-medium text-heading">Profile Photo</p>
 <p className="text-fs-xs text-muted-foreground mt-0.5">
 JPG, PNG or WebP. Max 5MB.
 </p>
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploadingAvatar}
 className="text-fs-xs text-primary font-medium mt-1.5 hover:underline disabled:opacity-50"
 >
 {uploadingAvatar ?"Uploading…" :"Upload new photo"}
 </button>
 </div>
 </div>

 <div className="space-y-4">
 {fields.map((f) => (
 <div key={f.key}>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">{f.label}</label>
 <div className="relative">
 <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type={f.type}
                value={form[f.key as keyof typeof form] as string}
 onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
 placeholder={f.placeholder}
 className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-fs-sm transition-shadow"
 />
 </div>
 </div>
 ))}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-fs-sm font-medium text-heading mb-1.5">Category</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full h-11 px-3 rounded-lg border border-input bg-background text-fs-sm"
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-fs-sm font-medium text-heading mb-1.5">Years of Experience</label>
            <input
              type="number"
              min={0}
              max={80}
              value={form.experience_years}
              onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
              placeholder="e.g. 5"
              className="w-full h-11 px-3 rounded-lg border border-input bg-background text-fs-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-fs-sm font-medium text-heading mb-1.5">Skills</label>
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Type a skill and press Enter"
              className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-fs-sm"
            />
            <Button type="button" variant="outline" onClick={addSkill} className="gap-1">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-primary/10 text-primary text-fs-xs font-medium">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

 <div>
          <label className="block text-fs-sm font-medium text-heading mb-1.5">Description / Bio</label>
 <div className="relative">
 <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
 <textarea
 value={form.bio}
 onChange={(e) => setForm({ ...form, bio: e.target.value })}
 placeholder="Tell customers about your experience and specialties..."
 rows={4}
 className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background text-fs-sm transition-shadow resize-none"
 />
 </div>
 </div>

 <Button onClick={handleSave} disabled={loading} className="gap-2">
 <Save className="w-4 h-4" />
 {loading ?"Saving..." :"Save Profile"}
 </Button>
 </div>
 </div>

    {/* Certificates */}
    <div className="bg-card rounded-sm border border-border p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading level={3}  className="flex items-center gap-2">
            <Award className="w-4 h-4" /> Certificates & Licenses
          </Heading>
          <p className="text-fs-xs text-muted-foreground mt-0.5">PDF or images. Max 10MB each.</p>
        </div>
        <Button variant="outline" onClick={() => certInputRef.current?.click()} disabled={uploadingCert} className="gap-2">
          {uploadingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploadingCert ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={certInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleCertUpload}
          className="hidden"
        />
      </div>
      {certificates.length === 0 ? (
        <p className="text-fs-sm text-muted-foreground">No certificates uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {certificates.map((c) => (
            <li key={c.path} className="py-2 flex items-center justify-between gap-3">
              <a href={c.url} target="_blank" rel="noreferrer" className="text-fs-sm text-primary hover:underline truncate">
                {c.name}
              </a>
              <button onClick={() => removeCertificate(c.path)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* Linked sections */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      {[
        { to: "/provider/availability", title: "Availability", desc: "Set weekly hours & blocked dates" },
        { to: "/provider/services", title: "Pricing & Services", desc: "Manage services and rates" },
        { to: "/provider-profile#portfolio", title: "Portfolio", desc: "Showcase your past work below" },
      ].map((l) => (
        <Link key={l.to} to={l.to} className="block bg-card rounded-sm border border-border p-4 hover:border-primary/40 transition-colors">
          <p className="text-fs-sm font-semibold text-heading">{l.title}</p>
          <p className="text-fs-xs text-muted-foreground mt-1">{l.desc}</p>
        </Link>
      ))}
    </div>
    </>
  );
};

export default ProviderProfileForm;
