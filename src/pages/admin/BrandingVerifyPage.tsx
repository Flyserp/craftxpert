import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoLight from "@/assets/taskhive-logo-light.png";
import logoDark from "@/assets/taskhive-logo-dark.png";
import { Heading } from "@/components/ui/app";

const KEYS = [
  "site_name", "site_tagline",
  "site_logo_url", "site_logo_light_url", "site_logo_dark_url",
  "site_pwa_logo_url", "site_favicon_url", "site_og_image_url",
  "pwa_icon_url", "pwa_app_name", "pwa_short_name",
  "pwa_theme_color", "pwa_background_color",
  "brand_primary", "brand_accent",
];

export default function BrandingVerifyPage() {
  const branding = usePwaBranding();
  const { resolved } = useTheme();
  const [raw, setRaw] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", KEYS);
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((r) => { map[r.key] = r.value; });
      setRaw(map);
      setLoading(false);
    })();
  }, [nonce]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const activeLogo = resolved === "dark"
    ? (branding.logoLightUrl || branding.logoUrl)
    : (branding.logoDarkUrl || branding.logoUrl);
  const activeLogoFallback = resolved === "dark" ? logoLight : logoDark;

  const faviconEl = typeof document !== "undefined"
    ? (document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null)?.href ?? null
    : null;
  const themeMeta = typeof document !== "undefined"
    ? (document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null)?.content ?? null
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading level={1} >Branding Verification</Heading>
          <p className="text-fs-sm text-muted-foreground mt-1">
            Confirms that the app is reading Platform Settings correctly and shows exactly what each surface renders — including fallbacks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logos</CardTitle>
          <CardDescription>Active theme: <strong>{resolved}</strong>. `Logo` component uses the opposite-tone URL first, then falls back to the bundled asset.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <LogoTile title="Light logo" url={branding.logoLightUrl} fallback={logoLight} settingKey="site_logo_light_url" />
          <LogoTile title="Dark logo" url={branding.logoDarkUrl} fallback={logoDark} settingKey="site_logo_dark_url" />
          <LogoTile title="PWA icon" url={branding.iconUrl} fallback={logoDark} settingKey="site_pwa_logo_url / pwa_icon_url" />
          <div className="sm:col-span-3 flex items-center gap-4 rounded-sm border border-border p-4 bg-muted/30">
            <img src={activeLogo || activeLogoFallback} alt="Active logo" className="h-12 w-12 object-contain" />
            <div className="text-fs-sm">
              <div className="font-medium">Currently rendered by &lt;Logo /&gt;</div>
              <div className="text-muted-foreground text-fs-xs break-all">
                {activeLogo ? <>Source: {activeLogo}</> : <>Using bundled fallback ({resolved} theme)</>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favicon & Head</CardTitle>
          <CardDescription>Live values patched into &lt;head&gt; by <code>usePwaBranding</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-fs-sm">
          <Row label="Favicon (resolved)" value={branding.faviconUrl || branding.iconUrl} fallback="none" preview={branding.faviconUrl || branding.iconUrl} />
          <Row label="<link rel=icon> href (live)" value={faviconEl} fallback="not injected" />
          <Row label="<meta theme-color> (live)" value={themeMeta} fallback="not injected" swatch={themeMeta ?? undefined} />
          <Row label="Apple touch icon" value={branding.iconUrl} fallback="bundled default" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO values (SEOHead.tsx)</CardTitle>
          <CardDescription>What the app injects for title, description, and og:image on every route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-fs-sm">
          <Row label="Site name" value={branding.siteName} fallback="TaskHive (bundled)" />
          <Row label="Site tagline" value={branding.siteTagline} fallback="default marketing description" />
          <Row label="App name (PWA)" value={branding.appName} fallback="TaskHive" />
          <Row label="Short name (PWA)" value={branding.shortName} fallback="TaskHive" />
          <Row label="OG image URL" value={branding.ogImageUrl} fallback="lovable default OG" preview={branding.ogImageUrl} />
          <Row label="document.title (live)" value={typeof document !== "undefined" ? document.title : null} fallback="—" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand colors</CardTitle>
          <CardDescription>Injected into CSS tokens <code>--primary</code> / <code>--accent</code> at runtime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-fs-sm">
          <Row label="Primary override" value={branding.brandPrimary} fallback="using theme default" swatch={branding.brandPrimary ?? undefined} />
          <Row label="Accent override" value={branding.brandAccent} fallback="using theme default" swatch={branding.brandAccent ?? undefined} />
          <Row label="PWA theme color" value={branding.themeColor} fallback="#00272c" swatch={branding.themeColor} />
          <Row label="PWA background color" value={branding.backgroundColor} fallback="#f7f9f7" swatch={branding.backgroundColor} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw platform_settings rows</CardTitle>
          <CardDescription>Straight from the database — useful to compare with the resolved values above.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-sm border border-border overflow-hidden">
            <div className="grid grid-cols-[220px_1fr_100px] bg-muted/40 text-fs-xs font-medium px-3 py-2 text-muted-foreground">
              <span>Key</span><span>Value</span><span className="text-right">Status</span>
            </div>
            {KEYS.map((k) => {
              const v = raw[k];
              const set = !!(v && v.trim());
              return (
                <div key={k} className="grid grid-cols-[220px_1fr_100px] items-center px-3 py-2 text-fs-xs border-t border-border">
                  <code className="text-muted-foreground">{k}</code>
                  <span className="truncate font-mono" title={v ?? ""}>{v || <em className="text-muted-foreground">null</em>}</span>
                  <span className="text-right">
                    {set ? (
                      <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Set</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground"><AlertTriangle className="h-3 w-3" /> Fallback</Badge>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogoTile({ title, url, fallback, settingKey }: { title: string; url: string | null; fallback: string; settingKey: string }) {
  const usingFallback = !url;
  return (
    <div className="rounded-sm border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-fs-sm font-medium">{title}</span>
        {usingFallback ? (
          <Badge variant="outline" className="gap-1 text-muted-foreground"><AlertTriangle className="h-3 w-3" /> Fallback</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Set</Badge>
        )}
      </div>
      <div className="h-20 flex items-center justify-center rounded-sm bg-muted/40 border border-border">
        <img src={url || fallback} alt={title} className="max-h-16 max-w-full object-contain" />
      </div>
      <div className="text-fs-xs text-muted-foreground break-all">
        <div><span className="font-medium text-foreground">Key:</span> <code>{settingKey}</code></div>
        <div className="mt-0.5">{url ? url : "Using bundled asset"}</div>
      </div>
    </div>
  );
}

function Row({ label, value, fallback, swatch, preview }: { label: string; value: string | null | undefined; fallback: string; swatch?: string; preview?: string | null }) {
  const has = !!(value && String(value).trim());
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <div className="min-w-[180px] text-muted-foreground">{label}</div>
      <div className="flex-1 flex items-center gap-2 justify-end text-right">
        {swatch && has && <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ background: swatch }} />}
        {preview && has && <img src={preview} alt="" className="h-6 w-6 object-contain rounded-sm border border-border bg-muted/40" />}
        <span className="font-mono text-fs-xs break-all">{has ? value : <em className="text-muted-foreground">{fallback}</em>}</span>
        {has ? (
          <Badge variant="secondary" className="gap-1 shrink-0"><CheckCircle2 className="h-3 w-3" /> Resolved</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground"><AlertTriangle className="h-3 w-3" /> Fallback</Badge>
        )}
      </div>
    </div>
  );
}