import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ProfileCompletion from "@/components/profile/ProfileCompletion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Save, LogOut, Shield, Mail, Heart, Briefcase, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Heading } from "@/components/ui/app";

export default function ClientProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ saved: 0, hires: 0, reviews: 0 });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [saved, hires, reviews] = await Promise.all([
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
      ]);
      setStats({
        saved: saved.count || 0,
        hires: hires.count || 0,
        reviews: reviews.count || 0,
      });
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Could not save changes");
    } else {
      toast.success("Profile updated");
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    await refreshProfile();
    setUploading(false);
    toast.success("Avatar updated");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <DashboardLayout title="Profile" subtitle="Manage your personal details and account.">
      <div className="max-w-2xl space-y-6">
        <ProfileCompletion
          checks={[
            { label: "Avatar", done: !!avatarUrl },
            { label: "Name", done: !!displayName.trim() },
            { label: "Phone", done: !!phone.trim() },
            { label: "Address", done: !!address.trim() },
            { label: "About", done: !!bio.trim() },
          ]}
        />
        <section className="bg-card border border-border rounded-sm p-6 animate-reveal">
          <Heading level={2}  className="mb-4">Profile photo</Heading>
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-fs-xl font-bold text-primary">
                  {(displayName || "U")[0]?.toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
                aria-label="Change photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="text-fs-xs text-muted-foreground">
              {uploading ? "Uploading…" : "JPG, PNG or GIF. Max 4 MB."}
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-sm p-6 animate-reveal-delay-1 space-y-4">
          <Heading level={2} >Personal details</Heading>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, country" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bio">About you</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A few words about you (optional)" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-sm p-6 animate-reveal-delay-2 space-y-4">
          <Heading level={2} >Account</Heading>
          <div className="flex items-center gap-3 text-fs-sm text-body">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/forgot-password")}>
              <Shield className="w-4 h-4" /> Change password
            </Button>
            <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { to: "/saved-providers", icon: Heart, label: "Saved Providers", value: stats.saved },
            { to: "/my-bookings", icon: Briefcase, label: "Hire History", value: stats.hires },
            { to: "/my-reviews", icon: Star, label: "Reviews Given", value: stats.reviews },
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
