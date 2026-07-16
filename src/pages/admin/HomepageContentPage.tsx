import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminPage from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ExternalLink, Star, Users, Megaphone } from "lucide-react";
import { Heading, LoadingState } from "@/components/ui/app";
import { useHomepageContent, DEFAULT_HOMEPAGE, type HomepageContent } from "@/hooks/useHomepageContent";

export default function HomepageContentPage() {
  const { content, loading, save } = useHomepageContent();
  const [draft, setDraft] = useState<HomepageContent>(DEFAULT_HOMEPAGE);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setDraft(content); }, [loading, content]);

  const handleSave = async () => {
    setSaving(true);
    try { await save(draft); toast.success("Homepage updated — live now"); }
    catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <AdminPage title="Homepage"><LoadingState variant="section" /></AdminPage>;
  }

  const updateHero = (k: keyof HomepageContent["hero"], v: any) =>
    setDraft((d) => ({ ...d, hero: { ...d.hero, [k]: v } }));
  const updatePromo = (k: keyof HomepageContent["promo"], v: any) =>
    setDraft((d) => ({ ...d, promo: { ...d.promo, [k]: v } }));
  const updateFooter = (k: keyof HomepageContent["footer"], v: any) =>
    setDraft((d) => ({ ...d, footer: { ...d.footer, [k]: v } }));

  return (
    <AdminPage title="Homepage" subtitle="Edit the public landing page. Changes appear immediately.">
      <div className="space-y-8 max-w-3xl">
        {/* Hero */}
        <Section title="Hero banner">
          <Field label="Badge">
            <Input value={draft.hero.badge} onChange={(e) => updateHero("badge", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Title — prefix">
              <Input value={draft.hero.title_prefix} onChange={(e) => updateHero("title_prefix", e.target.value)} />
            </Field>
            <Field label="Title — accent">
              <Input value={draft.hero.title_accent} onChange={(e) => updateHero("title_accent", e.target.value)} />
            </Field>
          </div>
          <Field label="Subtitle">
            <Textarea rows={2} value={draft.hero.subtitle} onChange={(e) => updateHero("subtitle", e.target.value)} />
          </Field>
          <Field label="Popular searches (comma separated)">
            <Input
              value={draft.hero.popular_searches.join(", ")}
              onChange={(e) => updateHero("popular_searches", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
        </Section>

        {/* Promo banner */}
        <Section title="Promotional banner" icon={<Megaphone className="w-4 h-4" />}>
          <div className="flex items-center justify-between">
            <Label className="text-fs-sm">Show banner above header</Label>
            <Switch checked={draft.promo.enabled} onCheckedChange={(v) => updatePromo("enabled", v)} />
          </div>
          <Field label="Message">
            <Input value={draft.promo.text} onChange={(e) => updatePromo("text", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Link label"><Input value={draft.promo.link_label || ""} onChange={(e) => updatePromo("link_label", e.target.value)} /></Field>
            <Field label="Link URL"><Input value={draft.promo.link_url || ""} onChange={(e) => updatePromo("link_url", e.target.value)} /></Field>
          </div>
        </Section>

        {/* Statistics */}
        <Section title="Statistics">
          {draft.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <Field label={i === 0 ? "Value" : undefined}>
                <Input value={s.value} onChange={(e) => setDraft((d) => ({ ...d, stats: d.stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} />
              </Field>
              <Field label={i === 0 ? "Label" : undefined}>
                <Input value={s.label} onChange={(e) => setDraft((d) => ({ ...d, stats: d.stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} />
              </Field>
              <Button variant="ghost" size="sm" className="w-10 p-0 text-destructive" onClick={() => setDraft((d) => ({ ...d, stats: d.stats.filter((_, j) => j !== i) }))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {draft.stats.length < 4 && (
            <Button variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, stats: [...d.stats, { value: "0", label: "New stat" }] }))}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add stat
            </Button>
          )}
        </Section>

        {/* Testimonials */}
        <Section title="Testimonials" icon={<Star className="w-4 h-4" />}>
          {draft.testimonials.map((t, i) => (
            <div key={i} className="rounded-sm border border-border p-3 space-y-2">
              <div className="grid sm:grid-cols-3 gap-2">
                <Input placeholder="Name" value={t.name} onChange={(e) => updTestimonial(setDraft, i, { name: e.target.value, initials: deriveInitials(e.target.value) })} />
                <Input placeholder="Role" value={t.role} onChange={(e) => updTestimonial(setDraft, i, { role: e.target.value })} />
                <Input placeholder="Location" value={t.location} onChange={(e) => updTestimonial(setDraft, i, { location: e.target.value })} />
              </div>
              <Textarea rows={2} placeholder="Quote" value={t.text} onChange={(e) => updTestimonial(setDraft, i, { text: e.target.value })} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-fs-xs">Rating</Label>
                  <Input type="number" min={1} max={5} className="w-16 h-8" value={t.rating} onChange={(e) => updTestimonial(setDraft, i, { rating: Math.max(1, Math.min(5, parseInt(e.target.value) || 5)) })} />
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDraft((d) => ({ ...d, testimonials: d.testimonials.filter((_, j) => j !== i) }))}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, testimonials: [...d.testimonials, { name: "New customer", role: "Homeowner", location: "City", rating: 5, text: "", initials: "NC" }] }))}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add testimonial
          </Button>
        </Section>

        {/* Footer */}
        <Section title="Footer content">
          <Field label="Tagline">
            <Textarea rows={2} value={draft.footer.tagline} onChange={(e) => updateFooter("tagline", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Email"><Input value={draft.footer.email} onChange={(e) => updateFooter("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={draft.footer.phone} onChange={(e) => updateFooter("phone", e.target.value)} /></Field>
            <Field label="Address"><Input value={draft.footer.address} onChange={(e) => updateFooter("address", e.target.value)} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Newsletter title"><Input value={draft.footer.newsletter_title} onChange={(e) => updateFooter("newsletter_title", e.target.value)} /></Field>
            <Field label="Newsletter subtitle"><Input value={draft.footer.newsletter_subtitle} onChange={(e) => updateFooter("newsletter_subtitle", e.target.value)} /></Field>
          </div>
        </Section>

        {/* Managed elsewhere */}
        <Section title="Featured categories & providers" icon={<Users className="w-4 h-4" />}>
          <p className="text-description-sm">
            Manage on dedicated pages — changes appear on the homepage automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories">Manage categories <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/featured-providers">Manage featured providers <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Link>
            </Button>
          </div>
        </Section>

        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </AdminPage>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card p-5 space-y-3">
      <Heading level={3}  className="flex items-center gap-2">{icon}{title}</Heading>
      {children}
    </div>
  );
}

function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-fs-xs">{label}</Label>}
      {children}
    </div>
  );
}

function updTestimonial(setDraft: React.Dispatch<React.SetStateAction<HomepageContent>>, i: number, patch: Partial<HomepageContent["testimonials"][number]>) {
  setDraft((d) => ({ ...d, testimonials: d.testimonials.map((x, j) => j === i ? { ...x, ...patch } : x) }));
}

function deriveInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";
}