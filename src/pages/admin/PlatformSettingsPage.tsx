import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/app";
import { toast } from "sonner";
import { notifyBrandingUpdated } from "@/hooks/usePwaBranding";
import {
  Save, Loader2, Globe, Image as ImageIcon, Mail, MessageSquare, Bell,
  CreditCard, ShieldCheck, Briefcase, LayoutGrid, MapPin, Languages, Wrench, Clock, Percent,
  Upload, Trash2, ExternalLink, RefreshCw,
} from "lucide-react";

import { Link } from "react-router-dom";

// All platform settings keys grouped by section
const KEYS = {
  site: [
    "site_name", "site_tagline", "site_email", "site_phone", "site_address",
    "site_logo_url", "site_logo_light_url", "site_logo_dark_url",
    "site_pwa_logo_url", "site_pwa_logo_maskable_url",
    "site_email_logo_url", "site_og_image_url", "site_favicon_url",
  ],
  email: ["email_provider", "email_from_name", "email_from_address", "smtp_host", "smtp_port", "smtp_username"],
  emailSecret: ["smtp_password", "resend_api_key", "brevo_api_key"],
  sms: ["sms_provider", "sms_sender_id"],
  smsSecret: ["sms_api_key", "twilio_account_sid", "twilio_auth_token"],
  notif: ["notify_new_user", "notify_new_job", "notify_payment", "notify_verification", "notify_review"],
  payments: ["payment_currency", "payment_commission_pct", "payment_min_payout", "tax_rate_pct", "tax_label", "tax_inclusive"],
  fees: ["vendor_verification_fee", "employer_verification_fee", "job_posting_fee", "featured_job_fee", "service_fee_pct", "service_fee_flat", "sponsorship_price_per_day", "sponsorship_durations"],
  localization: ["default_language", "default_timezone", "default_country", "date_format"],
  taxonomy: ["categories_csv", "locations_csv", "languages_csv"],
  maintenance: ["maintenance_mode", "maintenance_message"],
  verification: [
    "vendor_verification_validity_days",
    "employer_verification_validity_days",
    "verification_reminder_days_csv",
    "verification_warn_days",
  ],
  subscriptions: [
    "subscription_renewal_reminder_days_csv",
  ],
} as const;


const ALL_KEYS = [
  ...KEYS.site, ...KEYS.email, ...KEYS.emailSecret, ...KEYS.sms, ...KEYS.smsSecret,
  ...KEYS.notif, ...KEYS.payments, ...KEYS.fees, ...KEYS.localization, ...KEYS.taxonomy, ...KEYS.maintenance,
  ...KEYS.verification,
  ...KEYS.subscriptions,
];



const SECRET_KEYS = new Set<string>([...KEYS.emailSecret, ...KEYS.smsSecret]);
const BOOL_KEYS = new Set<string>([...KEYS.notif, "maintenance_mode", "tax_inclusive"]);

type ValuesMap = Record<string, string>;
type Setter = (k: string, v: string) => void;

function Field({ k, label, placeholder, type = "text", help, values, set }:
  { k: string; label: string; placeholder?: string; type?: string; help?: string; values?: ValuesMap; set: Setter }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-fs-sm">{label}</Label>
      <Input id={k} type={type} placeholder={placeholder} value={values?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
      {help && <p className="text-fs-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function TextField({ k, label, placeholder, rows = 3, values, set }:
  { k: string; label: string; placeholder?: string; rows?: number; values?: ValuesMap; set: Setter }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-fs-sm">{label}</Label>
      <Textarea id={k} rows={rows} placeholder={placeholder} value={values?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
}

function Toggle({ k, label, desc, values, set }:
  { k: string; label: string; desc?: string; values?: ValuesMap; set: Setter }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <p className="text-fs-sm font-medium text-heading">{label}</p>
        {desc && <p className="text-fs-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch
        checked={(values?.[k] ?? "") === "true"}
        onCheckedChange={(v) => set(k, v ? "true" : "false")}
      />
    </div>
  );
}

function ImageUpload({ kind, urlKey, label, help, values, set, uploading, onUpload }:
  { kind: string; urlKey: string; label: string; help?: string; values?: ValuesMap; set: Setter;
    uploading: string | null; onUpload: (kind: string, urlKey: string, file: File) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-fs-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <div className={`h-16 w-16 rounded-sm border border-border flex items-center justify-center overflow-hidden shrink-0 ${kind === "logo-dark" ? "bg-[#00292E]" : "bg-muted/40"}`}>
          {values?.[urlKey] ? (
            <img src={values[urlKey]} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={uploading === kind}>
            <label className="cursor-pointer">
              {uploading === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-2">Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(kind, urlKey, f); }}
              />
            </label>
          </Button>
          {values?.[urlKey] && (
            <Button variant="ghost" size="sm" onClick={() => set(urlKey, "")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {help && <p className="text-fs-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export default function PlatformSettingsPage() {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value ?? ""; });
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const rows = ALL_KEYS.map((key) => ({
      key,
      value: (values[key] ?? "").toString().trim() || null,
      is_secret: SECRET_KEYS.has(key),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }));
    for (const row of rows) {
      const { error } = await supabase.from("platform_settings").upsert(row, { onConflict: "key" });
      if (error) {
        toast.error(`Failed to save ${row.key}: ${error.message}`);
        setSaving(false);
        return;
      }
    }
    notifyBrandingUpdated();
    toast.success("Platform settings saved");
    setSaving(false);
  };

  const handleUpload = async (kind: string, urlKey: string, file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2MB");
    setUploading(kind);
    const ext = file.name.split(".").pop() || "png";
    const path = `${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); setUploading(null); return; }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    set(urlKey, pub.publicUrl);
    setUploading(null);
    toast.success("Uploaded — remember to Save");
  };

  const maintenanceOn = (values["maintenance_mode"] ?? "") === "true";

  return (
    <AdminPage
      title="Platform Settings"
      subtitle="Manage site information, branding, communications, payments, and content."
      actions={
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-2">Save changes</span>
        </Button>
      }
    >
      {loading ? (
        <LoadingState variant="section" />
      ) : (
        <>
          {maintenanceOn && (
            <div className="mb-4 flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20 dark:border-amber-800">
              <Wrench className="h-4 w-4 text-amber-600" />
              <p className="text-fs-sm text-amber-900 dark:text-amber-200">Maintenance mode is enabled. Non-admin users see a banner.</p>
            </div>
          )}

          <Tabs defaultValue="site" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="site"><Globe className="h-4 w-4 mr-1.5" />Site</TabsTrigger>
              <TabsTrigger value="branding"><ImageIcon className="h-4 w-4 mr-1.5" />Branding</TabsTrigger>
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1.5" />Email</TabsTrigger>
              <TabsTrigger value="sms"><MessageSquare className="h-4 w-4 mr-1.5" />SMS</TabsTrigger>
              <TabsTrigger value="notif"><Bell className="h-4 w-4 mr-1.5" />Notifications</TabsTrigger>
              <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Payments</TabsTrigger>
              <TabsTrigger value="fees"><Briefcase className="h-4 w-4 mr-1.5" />Fees</TabsTrigger>
              <TabsTrigger value="localization"><Languages className="h-4 w-4 mr-1.5" />Localization</TabsTrigger>
              <TabsTrigger value="taxonomy"><LayoutGrid className="h-4 w-4 mr-1.5" />Taxonomy</TabsTrigger>
              <TabsTrigger value="verification"><ShieldCheck className="h-4 w-4 mr-1.5" />Verification</TabsTrigger>
              <TabsTrigger value="subscriptions"><RefreshCw className="h-4 w-4 mr-1.5" />Subscriptions</TabsTrigger>
              <TabsTrigger value="maintenance"><Wrench className="h-4 w-4 mr-1.5" />Maintenance</TabsTrigger>

            </TabsList>


            <TabsContent value="site" className="mt-6 space-y-4 max-w-2xl">
              <Field k="site_name" label="Site Name" placeholder="TaskHive" values={values} set={set} />
              <Field k="site_tagline" label="Tagline" placeholder="Multi-tenant SaaS marketplace" values={values} set={set} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="site_email" label="Contact Email" type="email" placeholder="support@example.com" values={values} set={set} />
                <Field k="site_phone" label="Contact Phone" placeholder="+1 555 555 0100" values={values} set={set} />
              </div>
              <TextField k="site_address" label="Business Address" placeholder="123 Main St, City, Country" values={values} set={set} />
            </TabsContent>

            <TabsContent value="branding" className="mt-6 space-y-8 max-w-2xl">
              <div className="space-y-4">
                <p className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground">Logos</p>
                <ImageUpload kind="logo" urlKey="site_logo_url" label="Primary Logo" help="Default logo used across the app. PNG/SVG, max 2MB." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
                <ImageUpload kind="logo-light" urlKey="site_logo_light_url" label="Light Mode Logo" help="Shown on light backgrounds. Falls back to primary." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
                <ImageUpload kind="logo-dark" urlKey="site_logo_dark_url" label="Dark Mode Logo" help="Shown on dark backgrounds. Use a light-colored mark." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
              </div>

              <div className="space-y-4">
                <p className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground">PWA & Mobile</p>
                <ImageUpload kind="pwa-logo" urlKey="site_pwa_logo_url" label="PWA Icon" help="512×512 square. Used for install prompts and home screen." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
                <ImageUpload kind="pwa-maskable" urlKey="site_pwa_logo_maskable_url" label="PWA Maskable Icon" help="512×512 with safe area. Android adaptive icons." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
              </div>

              <div className="space-y-4">
                <p className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground">Sharing & Browser</p>
                <ImageUpload kind="email-logo" urlKey="site_email_logo_url" label="Email Header Logo" help="Used in transactional email templates." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
                <ImageUpload kind="og-image" urlKey="site_og_image_url" label="Social Share Image" help="1200×630 OpenGraph / Twitter preview." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
                <ImageUpload kind="favicon" urlKey="site_favicon_url" label="Favicon" help="512×512 recommended. Browser tab icon." values={values} set={set} uploading={uploading} onUpload={handleUpload} />
              </div>

              <div className="rounded-sm border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-fs-sm">
                    <p className="font-medium text-heading">Per-tenant brand colors</p>
                    <p className="text-muted-foreground mt-1">Primary/accent overrides live on the brand colors page.</p>
                    <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                      <Link to="/admin/branding">Open brand colors <ExternalLink className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-6 space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="email_provider" label="Provider" placeholder="smtp / resend / brevo" values={values} set={set} />
                <Field k="email_from_name" label="From Name" placeholder="TaskHive" values={values} set={set} />
              </div>
              <Field k="email_from_address" label="From Address" type="email" placeholder="noreply@example.com" values={values} set={set} />
              <div className="grid sm:grid-cols-3 gap-4">
                <Field k="smtp_host" label="SMTP Host" placeholder="smtp.example.com" values={values} set={set} />
                <Field k="smtp_port" label="SMTP Port" placeholder="587" values={values} set={set} />
                <Field k="smtp_username" label="SMTP Username" values={values} set={set} />
              </div>
              <Field k="smtp_password" label="SMTP Password" type="password" help="Stored as a secret." values={values} set={set} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="resend_api_key" label="Resend API Key" type="password" values={values} set={set} />
                <Field k="brevo_api_key" label="Brevo API Key" type="password" values={values} set={set} />
              </div>
            </TabsContent>

            <TabsContent value="sms" className="mt-6 space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="sms_provider" label="Provider" placeholder="twilio / gatewayapi" values={values} set={set} />
                <Field k="sms_sender_id" label="Sender ID" placeholder="WRAPCO" values={values} set={set} />
              </div>
              <Field k="sms_api_key" label="API Key" type="password" values={values} set={set} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="twilio_account_sid" label="Twilio Account SID" values={values} set={set} />
                <Field k="twilio_auth_token" label="Twilio Auth Token" type="password" values={values} set={set} />
              </div>
            </TabsContent>

            <TabsContent value="notif" className="mt-6 max-w-2xl">
              <div className="rounded-sm border border-border bg-card px-4">
                <Toggle k="notify_new_user" label="New user signup" desc="Notify admins when a new user registers." values={values} set={set} />
                <Toggle k="notify_new_job" label="New job posted" desc="Send alerts to matching providers." values={values} set={set} />
                <Toggle k="notify_payment" label="Payment events" desc="Receipts, refunds, payouts." values={values} set={set} />
                <Toggle k="notify_verification" label="Verification updates" desc="Approved / rejected document reviews." values={values} set={set} />
                <Toggle k="notify_review" label="New reviews" desc="Notify providers about new ratings." values={values} set={set} />
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-6 space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-3 gap-4">
                <Field k="payment_currency" label="Currency" placeholder="USD" values={values} set={set} />
                <Field k="payment_commission_pct" label="Commission %" type="number" placeholder="10" values={values} set={set} />
                <Field k="payment_min_payout" label="Min Payout" type="number" placeholder="50" values={values} set={set} />
              </div>
              <div className="rounded-sm border border-border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <p className="text-fs-sm font-medium text-heading">Taxes</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="tax_rate_pct" label="Tax Rate %" type="number" placeholder="20" help="Applied to bookings & job fees." values={values} set={set} />
                  <Field k="tax_label" label="Tax Label" placeholder="VAT / GST / Sales Tax" values={values} set={set} />
                </div>
                <Toggle k="tax_inclusive" label="Prices include tax" desc="When on, displayed prices already include tax." values={values} set={set} />
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-fs-sm font-medium text-heading">Gateways & Subscription Plans</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/payment-settings">Configure Stripe / PayPal <ExternalLink className="h-3 w-3 ml-1" /></Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/provider-subscription">Subscription plans <ExternalLink className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fees" className="mt-6 space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="vendor_verification_fee" label="Vendor Verification Fee ($/year)" type="number" placeholder="10" help="Annual KYC fee charged to providers. Verification expires 1 year after approval." values={values} set={set} />
                <Field k="employer_verification_fee" label="Employer Verification Fee ($/year)" type="number" placeholder="10" help="Annual KYC fee charged to employers. Verification expires 1 year after approval." values={values} set={set} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="job_posting_fee" label="Job Posting Fee" type="number" placeholder="5" help="Pay-per-post amount." values={values} set={set} />
                <Field k="featured_job_fee" label="Featured Job Fee" type="number" placeholder="20" help="Boost a job to the top." values={values} set={set} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="service_fee_pct" label="Service Fee %" type="number" placeholder="3" help="Percentage added to every booking." values={values} set={set} />
                <Field k="service_fee_flat" label="Service Fee (flat)" type="number" placeholder="1.5" help="Flat amount added to every booking." values={values} set={set} />
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-fs-sm font-semibold text-heading">Sponsored Services</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="sponsorship_price_per_day" label="Price per day ($)" type="number" placeholder="0.65" help="Charged to providers per sponsored day." values={values} set={set} />
                  <Field k="sponsorship_durations" label="Allowed durations (days)" placeholder="7,14,30,60,90" help="Comma-separated list shown to providers." values={values} set={set} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="localization" className="mt-6 space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="default_language" label="Default Language" placeholder="en" help="ISO code, e.g. en, es, fr, ar." values={values} set={set} />
                <Field k="default_timezone" label="Default Timezone" placeholder="UTC" help="IANA name, e.g. UTC, Europe/London, America/New_York." values={values} set={set} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="default_country" label="Default Country" placeholder="US" help="ISO 2-letter country code." values={values} set={set} />
                <Field k="date_format" label="Date Format" placeholder="YYYY-MM-DD" values={values} set={set} />
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-4 flex items-start gap-3">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-fs-sm text-muted-foreground">These defaults apply to new users and any UI where a user preference is not set.</p>
              </div>
            </TabsContent>

            <TabsContent value="taxonomy" className="mt-6 space-y-4 max-w-2xl">
              <div className="rounded-sm border border-border bg-muted/30 p-4 flex items-start gap-3">
                <LayoutGrid className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-fs-sm flex-1">
                  <p className="font-medium text-heading">Service Categories</p>
                  <p className="text-muted-foreground mt-1">Full CRUD lives on the categories page.</p>
                  <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                    <Link to="/admin/categories">Manage categories <ExternalLink className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              </div>
              <TextField k="locations_csv" label={"Locations (comma-separated)"} placeholder="New York, London, Dubai, Sydney" rows={3} values={values} set={set} />
              <TextField k="languages_csv" label={"Languages (comma-separated)"} placeholder="English, Spanish, French, Arabic" rows={2} values={values} set={set} />
            </TabsContent>

            <TabsContent value="verification" className="mt-6 space-y-4 max-w-2xl">
              <div className="rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-fs-xs text-muted-foreground">
                  Controls how long a verified badge lasts and when re-verification reminders are sent. Applies to both providers and employers on next approval.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field k="vendor_verification_validity_days" label="Provider validity (days)" type="number" placeholder="365" help="How long a provider stays verified after approval." values={values} set={set} />
                <Field k="employer_verification_validity_days" label="Employer validity (days)" type="number" placeholder="365" help="How long an employer stays verified after approval." values={values} set={set} />
              </div>
              <Field k="verification_reminder_days_csv" label="Reminder windows (comma-separated days)" placeholder="30,7,1" help="Days before expiry when re-verification reminder notifications are sent." values={values} set={set} />
              <Field k="verification_warn_days" label="Dashboard warning threshold (days)" type="number" placeholder="30" help="When the dashboard banner starts prompting to renew." values={values} set={set} />
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 space-y-4 max-w-2xl">
              <div className="rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-fs-xs text-muted-foreground">
                  Controls when providers receive renewal reminders before their subscription's current period ends. Change and save to apply on the next scheduled run of the reminder job.
                </p>
              </div>
              <Field
                k="subscription_renewal_reminder_days_csv"
                label="Renewal reminder windows (comma-separated days)"
                placeholder="30,7,1"
                help="Days before current_period_end when a renewal reminder notification is sent. One reminder per window per subscription. Defaults to 7,1 when empty."
                values={values}
                set={set}
              />
            </TabsContent>



            <TabsContent value="maintenance" className="mt-6 max-w-2xl space-y-4">
              <div className="rounded-sm border border-border bg-card px-4">
                <Toggle k="maintenance_mode" label="Enable maintenance mode" desc="Non-admin users see a maintenance banner across the app." values={values} set={set} />
              </div>
              <TextField k="maintenance_message" label="Maintenance Message" placeholder="We'll be back shortly — performing scheduled upgrades." rows={3} values={values} set={set} />
            </TabsContent>
          </Tabs>

        </>
      )}
    </AdminPage>
  );
}
