import { useEffect, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CreditCard, Eye, EyeOff, Save, Loader2, CheckCircle2,
  AlertTriangle, ExternalLink, Shield, Smartphone, Upload, Trash2, Image as ImageIcon,
} from "lucide-react";
import { Heading, LoadingState } from "@/components/ui/app";

interface SettingRow {
  key: string;
  value: string | null;
  is_secret: boolean;
}

const STRIPE_KEYS = [
  {
    key: "stripe_publishable_key",
    label: "Publishable Key",
    placeholder: "pk_live_... or pk_test_...",
    secret: false,
    help: "Starts with pk_live_ or pk_test_",
  },
  {
    key: "stripe_secret_key",
    label: "Secret Key",
    placeholder: "sk_live_... or sk_test_...",
    secret: true,
    help: "Starts with sk_live_ or sk_test_. Never share publicly.",
  },
  {
    key: "stripe_webhook_secret",
    label: "Webhook Secret",
    placeholder: "whsec_...",
    secret: true,
    help: "Found in Stripe → Developers → Webhooks",
  },
];

const PWA_KEYS = [
  "pwa_icon_url",
  "pwa_app_name",
  "pwa_short_name",
  "pwa_theme_color",
  "pwa_background_color",
] as const;

export default function PaymentSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value, is_secret");

    const map: Record<string, string> = {};
    (data || []).forEach((row: SettingRow) => {
      map[row.key] = row.value || "";
    });
    setSettings(map);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const upserts = [
      ...STRIPE_KEYS.map((k) => ({
        key: k.key,
        value: settings[k.key]?.trim() || null,
        is_secret: k.secret,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })),
      {
        key: "low_credit_threshold",
        value: settings["low_credit_threshold"]?.trim() || "3",
        is_secret: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      ...PWA_KEYS.map((key) => ({
        key,
        value: settings[key]?.trim() || null,
        is_secret: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })),
    ];

    // Upsert each setting
    for (const row of upserts) {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(row, { onConflict: "key" });

      if (error) {
        toast.error(`Failed to save ${row.key}: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    toast.success("Payment settings saved successfully");
    setSaving(false);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG recommended, 512×512).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Icon must be smaller than 2MB.");
      return;
    }
    setUploadingIcon(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `pwa-icon-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setUploadingIcon(false);
      return;
    }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    setSettings((prev) => ({ ...prev, pwa_icon_url: pub.publicUrl }));
    await supabase
      .from("platform_settings")
      .upsert(
        { key: "pwa_icon_url", value: pub.publicUrl, is_secret: false, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    toast.success("PWA icon updated. Reload the app to see it everywhere.");
    setUploadingIcon(false);
  };

  const handleRemoveIcon = async () => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, pwa_icon_url: "" }));
    await supabase
      .from("platform_settings")
      .upsert(
        { key: "pwa_icon_url", value: null, is_secret: false, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    toast.success("PWA icon removed. Default logo will be used.");
  };

  const isConfigured = STRIPE_KEYS.every(
    (k) => settings[k.key]?.trim()
  );

  const isTestMode = settings["stripe_publishable_key"]?.startsWith("pk_test");

  const maskValue = (val: string) => {
    if (!val || val.length < 12) return "••••••••";
    return val.slice(0, 7) + "••••••••" + val.slice(-4);
  };

  return (
    <AdminPage title="Payment Settings" subtitle="Configure Stripe to enable payments across the platform.">
      {loading ? (
        <LoadingState variant="section" />
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Status banner */}
          <div
            className={`flex items-center gap-3 rounded-sm border p-4 animate-reveal ${
              isConfigured
                ? "bg-primary/5 border-primary/20"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
            }`}
          >
            {isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-fs-sm font-medium text-heading">
                {isConfigured
                  ? `Stripe is configured${isTestMode ? " (Test Mode)" : ""}`
                  : "Stripe is not configured yet"}
              </p>
              <p className="text-fs-xs text-muted-foreground mt-0.5">
                {isConfigured
                  ? "Payments are active. Tenants can subscribe and customers can pay for bookings."
                  : "Enter your Stripe API keys below to enable payments and subscriptions."}
              </p>
            </div>
            {isTestMode && isConfigured && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded-sm shrink-0">
                Test
              </span>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-card rounded-sm border border-border p-5 animate-reveal" style={{ animationDelay: "80ms" }}>
            <Heading level={3}  className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              Setup Instructions
            </Heading>
            <ol className="text-fs-sm text-body space-y-2 list-decimal list-inside">
              <li>
                Go to your{" "}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Stripe Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Copy your <strong>Publishable key</strong> and <strong>Secret key</strong></li>
              <li>For webhooks, go to Developers → Webhooks → Add endpoint</li>
              <li>Paste the keys below and save</li>
            </ol>
          </div>

          {/* API Keys form */}
          <div className="bg-card rounded-sm border border-border p-6 space-y-5 animate-reveal" style={{ animationDelay: "160ms" }}>
            <Heading level={3}  className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Stripe API Keys
            </Heading>

            {STRIPE_KEYS.map((k) => (
              <div key={k.key} className="space-y-1.5">
                <Label className="text-fs-xs flex items-center gap-1.5">
                  {k.label}
                  {k.secret && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
                      Secret
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type={k.secret && !showSecrets[k.key] ? "password" : "text"}
                    value={settings[k.key] || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, [k.key]: e.target.value }))
                    }
                    placeholder={k.placeholder}
                    className="pr-10 font-mono text-fs-sm"
                  />
                  {k.secret && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSecrets((prev) => ({
                          ...prev,
                          [k.key]: !prev[k.key],
                        }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSecrets[k.key] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{k.help}</p>
              </div>
            ))}

            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </div>
          {/* Provider alert thresholds */}
          <div className="bg-card rounded-sm border border-border p-6 space-y-5 animate-reveal" style={{ animationDelay: "240ms" }}>
            <Heading level={3}  className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Provider Alert Thresholds
            </Heading>

            <div className="space-y-1.5">
              <Label className="text-fs-xs">Low lead-credit threshold</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={settings["low_credit_threshold"] ?? "3"}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, low_credit_threshold: e.target.value }))
                }
                placeholder="3"
                className="font-mono text-fs-sm max-w-[160px]"
              />
              <p className="text-[13px] text-muted-foreground">
                Providers with a lead-credit balance below this number will see a "low credits" badge on the More tab.
              </p>
            </div>
          </div>

          {/* PWA / Branding */}
          <div className="bg-card rounded-sm border border-border p-6 space-y-5 animate-reveal" style={{ animationDelay: "320ms" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Heading level={3}  className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Installable App (PWA) Branding
                </Heading>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Controls the icon and colors users see when they install the app to their home screen.
                </p>
              </div>
            </div>

            {/* Icon uploader */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-sm border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {settings["pwa_icon_url"] ? (
                  <img src={settings["pwa_icon_url"]} alt="PWA icon" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-fs-xs">App icon (512×512 PNG recommended)</Label>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleIconUpload}
                      disabled={uploadingIcon}
                    />
                    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-sm text-fs-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
                      {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingIcon ? "Uploading…" : "Upload icon"}
                    </span>
                  </label>
                  {settings["pwa_icon_url"] && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveIcon} className="gap-1.5 text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">
                  Square image, transparent or solid background. Stored in the public branding bucket.
                </p>
              </div>
            </div>

            {/* Names + colors */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-fs-xs">App name</Label>
                <Input
                  value={settings["pwa_app_name"] ?? ""}
                  onChange={(e) => setSettings((p) => ({ ...p, pwa_app_name: e.target.value }))}
                  placeholder="TaskHive"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Short name (home screen)</Label>
                <Input
                  value={settings["pwa_short_name"] ?? ""}
                  onChange={(e) => setSettings((p) => ({ ...p, pwa_short_name: e.target.value }))}
                  placeholder="TaskHive"
                  maxLength={12}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Theme color (browser UI)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings["pwa_theme_color"] || "#00272c"}
                    onChange={(e) => setSettings((p) => ({ ...p, pwa_theme_color: e.target.value }))}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings["pwa_theme_color"] ?? ""}
                    onChange={(e) => setSettings((p) => ({ ...p, pwa_theme_color: e.target.value }))}
                    placeholder="#00272c"
                    className="font-mono text-fs-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Background color (splash)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings["pwa_background_color"] || "#f7f9f7"}
                    onChange={(e) => setSettings((p) => ({ ...p, pwa_background_color: e.target.value }))}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings["pwa_background_color"] ?? ""}
                    onChange={(e) => setSettings((p) => ({ ...p, pwa_background_color: e.target.value }))}
                    placeholder="#f7f9f7"
                    className="font-mono text-fs-sm"
                  />
                </div>
              </div>
            </div>

            <p className="text-[13px] text-muted-foreground">
              Click <strong>Save Settings</strong> above to persist the name & color changes. Icon uploads save instantly.
            </p>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
