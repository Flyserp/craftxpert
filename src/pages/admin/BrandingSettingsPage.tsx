import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyBrandColors, notifyBrandingUpdated } from "@/hooks/usePwaBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, RotateCcw, Save, Palette, History, Users, Store, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Heading } from "@/components/ui/app";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const KEYS = ["brand_primary", "brand_accent"] as const;

export default function BrandingSettingsPage() {
  const { user } = useAuth();
  const [primary, setPrimary] = useState("");
  const [accent, setAccent] = useState("");
  const [savedPrimary, setSavedPrimary] = useState<string | null>(null);
  const [savedAccent, setSavedAccent] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditReloadKey, setAuditReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", KEYS as unknown as string[]);
      const map = new Map((data ?? []).map((r) => [r.key, r.value ?? ""]));
      const p = map.get("brand_primary") ?? "";
      const a = map.get("brand_accent") ?? "";
      setPrimary(p);
      setAccent(a);
      setSavedPrimary(p || null);
      setSavedAccent(a || null);
      setLoading(false);
    })();
  }, []);

  // Live preview: re-apply tokens to :root whenever inputs change (debounced).
  // On unmount, restore the persisted values so navigating away doesn't leak unsaved edits.
  useEffect(() => {
    if (loading || !livePreview) return;
    const t = setTimeout(() => {
      applyBrandColors(
        HEX_RE.test(primary) ? primary : null,
        HEX_RE.test(accent) ? accent : null,
      );
    }, 80);
    return () => clearTimeout(t);
  }, [primary, accent, livePreview, loading]);

  useEffect(() => {
    return () => {
      // Restore saved values when leaving the page (covers unsaved edits).
      applyBrandColors(savedPrimary, savedAccent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPrimary, savedAccent]);

  const primaryValid = !primary || HEX_RE.test(primary);
  const accentValid = !accent || HEX_RE.test(accent);
  const canSave = primaryValid && accentValid && !saving;

  const handleSave = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    const rows = [
      { key: "brand_primary", value: primary.trim() || null, is_secret: false, updated_by: user.id, updated_at: new Date().toISOString() },
      { key: "brand_accent", value: accent.trim() || null, is_secret: false, updated_by: user.id, updated_at: new Date().toISOString() },
    ];
    for (const row of rows) {
      const { error } = await supabase.from("platform_settings").upsert(row, { onConflict: "key" });
      if (error) {
        toast.error(`Failed to save ${row.key}: ${error.message}`);
        setSaving(false);
        return;
      }
    }
    applyBrandColors(primary || null, accent || null);
    setSavedPrimary(primary || null);
    setSavedAccent(accent || null);
    // DB trigger auto-bumps `brand_version`; notify so every mounted
    // usePwaBranding() re-reads and picks up the new ?bv=… on branding URLs.
    notifyBrandingUpdated();
    toast.success("Branding saved and applied");
    setSaving(false);
    setAuditReloadKey((k) => k + 1);
  };

  const handleReset = () => {
    setPrimary("");
    setAccent("");
    applyBrandColors(null, null);
    toast.message("Reset to defaults (unsaved — click Save to persist)");
  };

  const handleRevert = () => {
    setPrimary(savedPrimary ?? "");
    setAccent(savedAccent ?? "");
    applyBrandColors(savedPrimary, savedAccent);
    toast.message("Reverted to last saved values");
  };

  const isDirty = (primary || "") !== (savedPrimary ?? "") || (accent || "") !== (savedAccent ?? "");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Heading level={1}  className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Brand Colors
        </Heading>
        <p className="text-fs-sm text-muted-foreground mt-1">
          Override the tenant primary and accent colors. Changes preview instantly across every dashboard page — click <strong>Save</strong> to persist.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Color tokens</CardTitle>
          <CardDescription>Enter a hex value (e.g. <code>#00292E</code>) or pick from the swatch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ColorField
            label="Primary"
            value={primary}
            onChange={setPrimary}
            valid={primaryValid}
            placeholder="#00292E"
          />
          <ColorField
            label="Accent"
            value={accent}
            onChange={setAccent}
            valid={accentValid}
            placeholder="#9DBD47"
          />

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save & apply
            </Button>
            {isDirty && (
              <Button variant="ghost" onClick={handleRevert} type="button">
                Revert unsaved
              </Button>
            )}
            <Button variant="outline" onClick={handleReset} type="button">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <label
              className="ml-auto flex items-center gap-2 text-fs-xs text-muted-foreground select-none cursor-pointer"
              title="Applies the preview only to your browser tab. Nothing is saved until you click Save."
            >
              <input
                type="checkbox"
                checked={livePreview}
                onChange={(e) => {
                  setLivePreview(e.target.checked);
                  if (!e.target.checked) applyBrandColors(savedPrimary, savedAccent);
                }}
                className="accent-primary"
              />
              Session-only preview (just me)
            </label>
          </div>
          {livePreview && (
            <p className="text-fs-xs text-muted-foreground">
              {isDirty ? (
                <>
                  <span className="inline-flex items-center rounded-sm bg-accent/20 border border-accent/40 px-1.5 py-0.5 font-medium mr-1">
                    Session-only
                  </span>
                  These unsaved colors are visible only in your browser tab — other admins and users still see the saved theme. Click <strong>Save &amp; apply</strong> to publish them.
                </>
              ) : (
                <>Edits will preview in your tab only. Nothing is shared with other users until you Save.</>
              )}
            </p>
          )}
          {!livePreview && isDirty && (
            <p className="text-fs-xs text-muted-foreground">
              Session-only preview is off — edits won't render until you re-enable it or click Save.
            </p>
          )}
        </CardContent>
      </Card>

      <LivePreview primary={primary} accent={accent} />
      <DashboardPreview />
      <AuditTrail reloadKey={auditReloadKey} />
    </div>
  );
}

/**
 * Mini-dashboard preview that uses the same semantic tokens as the real app,
 * so changing `--primary` / `--accent` above instantly recolors this card too.
 * A page selector lets admins preview the Customer, Vendor, and Admin layouts.
 */
type PreviewPage = "customer" | "vendor" | "admin";

function DashboardPreview() {
  const [page, setPage] = useState<PreviewPage>("customer");
  const tabs: { id: PreviewPage; label: string; icon: typeof Users }[] = [
    { id: "customer", label: "Customers", icon: Users },
    { id: "vendor", label: "Vendors", icon: Store },
    { id: "admin", label: "Admin", icon: ShieldCheck },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Dashboard preview</CardTitle>
            <CardDescription>Switch layouts to see live primary/accent changes per role.</CardDescription>
          </div>
          <div className="inline-flex rounded-sm border border-border bg-muted/40 p-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = page === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPage(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-fs-xs rounded-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {page === "customer" && <CustomerPreview />}
        {page === "vendor" && <VendorPreview />}
        {page === "admin" && <AdminPreview />}
      </CardContent>
    </Card>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-destructive/60" />
        <span className="h-2 w-2 rounded-full bg-accent/70" />
        <span className="h-2 w-2 rounded-full bg-primary/60" />
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function CustomerPreview() {
  return (
    <PreviewShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} >My bookings</Heading>
        <Button size="sm">Book a service</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="text-fs-xs text-muted-foreground">Upcoming</div>
          <div className="text-fs-xl font-semibold text-primary">4</div>
        </div>
        <div className="rounded-sm border border-border bg-primary text-primary-foreground p-3">
          <div className="text-fs-xs opacity-80">Wallet</div>
          <div className="text-fs-xl font-semibold">$120</div>
        </div>
        <div className="rounded-sm border border-border bg-accent text-accent-foreground p-3">
          <div className="text-fs-xs opacity-80">Saved pros</div>
          <div className="text-fs-xl font-semibold">12</div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-sm border border-border p-3 text-fs-sm">
        <span>House cleaning · Sat 10:00</span>
        <span className="inline-flex items-center rounded-sm bg-primary/10 text-primary px-2 py-0.5 text-fs-xs font-medium">
          Confirmed
        </span>
      </div>
    </PreviewShell>
  );
}

function VendorPreview() {
  return (
    <PreviewShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} >Vendor overview</Heading>
        <Button size="sm" variant="outline">Add service</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="text-fs-xs text-muted-foreground">Jobs</div>
          <div className="text-fs-xl font-semibold text-primary">37</div>
        </div>
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="text-fs-xs text-muted-foreground">Rating</div>
          <div className="text-fs-xl font-semibold text-primary">4.8</div>
        </div>
        <div className="rounded-sm border border-border bg-primary text-primary-foreground p-3">
          <div className="text-fs-xs opacity-80">Earnings</div>
          <div className="text-fs-xl font-semibold">$2,140</div>
        </div>
        <div className="rounded-sm border border-border bg-accent text-accent-foreground p-3">
          <div className="text-fs-xs opacity-80">Pending</div>
          <div className="text-fs-xl font-semibold">3</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-fs-sm">
        <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
        <span className="text-muted-foreground">Availability accent uses your accent token.</span>
      </div>
    </PreviewShell>
  );
}

function AdminPreview() {
  return (
    <PreviewShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} >Platform admin</Heading>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Export</Button>
          <Button size="sm">New tenant</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-sm border border-border bg-card p-3">
          <div className="text-fs-xs text-muted-foreground">Tenants</div>
          <div className="text-fs-xl font-semibold text-primary">128</div>
        </div>
        <div className="rounded-sm border border-border bg-primary text-primary-foreground p-3">
          <div className="text-fs-xs opacity-80">MRR</div>
          <div className="text-fs-xl font-semibold">$48.2k</div>
        </div>
        <div className="rounded-sm border border-border bg-accent text-accent-foreground p-3">
          <div className="text-fs-xs opacity-80">Open disputes</div>
          <div className="text-fs-xl font-semibold">5</div>
        </div>
      </div>
      <div className="rounded-sm border border-border overflow-hidden">
        <div className="grid grid-cols-3 bg-muted/40 text-fs-xs font-medium px-3 py-2 text-muted-foreground">
          <span>Tenant</span><span>Plan</span><span className="text-right">Status</span>
        </div>
        {[
          ["Acme Co.", "Pro", "Active"],
          ["BrightClean", "Starter", "Trial"],
        ].map(([t, p, s]) => (
          <div key={t} className="grid grid-cols-3 px-3 py-2 text-fs-sm border-t border-border">
            <span>{t}</span>
            <span className="text-muted-foreground">{p}</span>
            <span className="text-right">
              <span className="inline-flex items-center rounded-sm bg-primary/10 text-primary px-2 py-0.5 text-fs-xs font-medium">
                {s}
              </span>
            </span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function ColorField({
  label,
  value,
  onChange,
  valid,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  valid: boolean;
  placeholder: string;
}) {
  // placeholder split to keep types tidy
  const showSwatch = value && valid;
  return (
    <div className="space-y-2">
      <Label className="text-fs-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={showSwatch ? normalize(value) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-sm border border-input bg-background cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={!valid ? "border-destructive focus-visible:ring-destructive" : ""}
          maxLength={7}
        />
      </div>
      {!valid && (
        <p className="text-fs-xs text-destructive">Invalid hex. Use #RGB or #RRGGBB.</p>
      )}
    </div>
  );
}

function LivePreview({ primary, accent }: { primary: string; accent: string }) {
  const p = HEX_RE.test(primary) ? primary : undefined;
  const a = HEX_RE.test(accent) ? accent : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live preview</CardTitle>
        <CardDescription>Auto-picked foreground with WCAG contrast ratio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <PreviewSwatch label="Primary" bg={p ?? "var(--token-primary)"} fallback={!p} />
        <PreviewSwatch label="Accent" bg={a ?? "var(--token-accent)"} fallback={!a} />
      </CardContent>
    </Card>
  );
}

function PreviewSwatch({ label, bg, fallback }: { label: string; bg: string; fallback: boolean }) {
  const fg = fallback ? undefined : pickFg(bg);
  const ratio = fallback || !fg ? null : contrastRatio(bg, fg);
  const grade = ratio ? wcagGrade(ratio) : null;
  return (
    <div>
      <div
        className="rounded-sm p-4 flex items-center justify-between border border-border"
        style={fallback ? undefined : { background: bg, color: fg }}
      >
        <span className="font-medium">{label} sample — Aa</span>
        <span className="text-fs-xs font-mono opacity-80">{fallback ? "— using default —" : bg.toUpperCase()}</span>
      </div>
      {ratio && grade && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-fs-xs">
          <span className="font-mono text-muted-foreground">
            {label.toLowerCase()}-foreground · {ratio.toFixed(2)}:1
          </span>
          <Badge tone={grade.normal.tone}>Normal AA {grade.normal.aa}</Badge>
          <Badge tone={grade.normal.toneAaa}>Normal AAA {grade.normal.aaa}</Badge>
          <Badge tone={grade.large.tone}>Large AA {grade.large.aa}</Badge>
          <Badge tone={grade.large.toneAaa}>Large AAA {grade.large.aaa}</Badge>
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "pass" | "fail"; children: React.ReactNode }) {
  const cls =
    tone === "pass"
      ? "bg-accent/20 text-foreground border-accent/40"
      : "bg-destructive/15 text-destructive border-destructive/40";
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-medium ${cls}`}>
      {children}
    </span>
  );
}

function normalize(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return `#${full.toLowerCase()}`;
}

function pickFg(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#161616" : "#ffffff";
}

function relLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function wcagGrade(ratio: number) {
  const mk = (ok: boolean) => (ok ? { label: "Pass", tone: "pass" as const } : { label: "Fail", tone: "fail" as const });
  const nAa = mk(ratio >= 4.5);
  const nAaa = mk(ratio >= 7);
  const lAa = mk(ratio >= 3);
  const lAaa = mk(ratio >= 4.5);
  return {
    normal: { aa: nAa.label, aaa: nAaa.label, tone: nAa.tone, toneAaa: nAaa.tone },
    large: { aa: lAa.label, aaa: lAaa.label, tone: lAa.tone, toneAaa: lAaa.tone },
  };
}

/* ============================================================
   Audit trail — surfaces rows already written by the
   `log_platform_setting_change` Postgres trigger into
   admin_audit_log every time `brand_primary` / `brand_accent`
   is inserted or updated in platform_settings.
   ============================================================ */
type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  actor_id: string | null;
  details: { key?: string; old_value?: string | null; new_value?: string | null } | null;
};

function AuditTrail({ reloadKey }: { reloadKey: number }) {
  const PAGE_SIZE = 20;
  const FETCH_BATCH = 200; // raw rows pulled per request; client-filters to brand_* entries
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<string | null>(null); // created_at cursor
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef(false);

  const hydrateActorNames = useCallback(async (incoming: AuditRow[]) => {
    const ids = Array.from(new Set(incoming.map((r) => r.actor_id).filter(Boolean) as string[]));
    if (!ids.length) return;
    const missing = ids.filter((id) => !(id in actors));
    if (!missing.length) return;
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", missing);
    const next = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.display_name ?? "Unknown"]));
    setActors((prev) => ({ ...prev, ...next }));
  }, [actors]);

  const fetchPage = useCallback(async () => {
    if (cancelRef.current || done) return;
    let q = supabase
      .from("admin_audit_log")
      .select("id, created_at, action, actor_id, details")
      .eq("entity_type", "platform_setting")
      .in("action", ["setting.insert", "setting.update"])
      .order("created_at", { ascending: false })
      .limit(FETCH_BATCH);
    if (cursorRef.current) q = q.lt("created_at", cursorRef.current);

    const { data, error } = await q;
    if (error || cancelRef.current) return;
    const batch = (data ?? []) as AuditRow[];

    if (batch.length < FETCH_BATCH) setDone(true);
    if (batch.length) cursorRef.current = batch[batch.length - 1].created_at;

    const filtered = batch.filter((r) => {
      const k = r.details?.key;
      return k === "brand_primary" || k === "brand_accent";
    });

    if (filtered.length) {
      setRows((prev) => prev.concat(filtered));
      await hydrateActorNames(filtered);
    } else if (!done && batch.length === FETCH_BATCH) {
      // No brand rows in this slab — keep paging until we find some or hit the end.
      await fetchPage();
    }
  }, [done, hydrateActorNames]);

  // Reset + first load whenever reloadKey changes.
  useEffect(() => {
    cancelRef.current = false;
    cursorRef.current = null;
    setRows([]);
    setDone(false);
    setLoading(true);
    fetchPage().finally(() => {
      if (!cancelRef.current) setLoading(false);
    });
    return () => { cancelRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // IntersectionObserver: load more when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done || loading) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore || done) return;
      setLoadingMore(true);
      await fetchPage();
      setLoadingMore(false);
    }, { root: el.closest("[data-audit-scroll]") as Element | null, rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [done, loading, loadingMore, fetchPage, rows.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Audit trail
        </CardTitle>
        <CardDescription>Every branding override is timestamped and attributed.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !loading && rows.length === 0 ? (
          <p className="text-fs-sm text-muted-foreground">No branding changes have been recorded yet.</p>
        ) : (
          <div
            data-audit-scroll
            className="max-h-[420px] overflow-y-auto rounded-sm border border-border"
          >
          <table className="w-full text-fs-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur text-fs-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Who</th>
                <th className="text-left font-medium px-3 py-2">Key</th>
                <th className="text-left font-medium px-3 py-2">Old</th>
                <th className="text-left font-medium px-3 py-2">New</th>
                <th className="text-right font-medium px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const k = r.details?.key ?? "";
              const oldV = r.details?.old_value ?? "—";
              const newV = r.details?.new_value ?? "—";
              const who = r.actor_id ? actors[r.actor_id] ?? r.actor_id.slice(0, 8) : "System";
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{who}</td>
                  <td className="px-3 py-2 font-mono text-fs-xs">{k}</td>
                  <td className="px-3 py-2"><AuditSwatch hex={oldV} /></td>
                  <td className="px-3 py-2"><AuditSwatch hex={newV} /></td>
                  <td className="px-3 py-2 text-right text-fs-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
          <div ref={sentinelRef} className="flex items-center justify-center py-3 text-fs-xs text-muted-foreground">
            {loadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…
              </span>
            ) : done ? (
              <span>End of history · {rows.length} entries</span>
            ) : (
              <span>Scroll for more</span>
            )}
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditSwatch({ hex }: { hex: string | null | undefined }) {
  const valid = !!hex && HEX_RE.test(hex);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-fs-xs">
      <span
        className="inline-block h-3 w-3 rounded border border-border"
        style={valid ? { background: hex! } : { background: "transparent" }}
        aria-hidden
      />
      {hex || "—"}
    </span>
  );
}
