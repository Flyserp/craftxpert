import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading, LoadingState } from "@/components/ui/app";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ClipboardList } from "lucide-react";
import { toast } from "sonner";

/**
 * Canonical taxonomy spec — must be present for every tenant.
 * 6 categories / 35 subcategories.
 */
const SPEC: Record<string, string[]> = {
  "Home Services": [
    "Builders", "Cleaners", "Electricians", "Gardeners",
    "Movers", "Painters", "Plumbers", "Roofers",
  ],
  "Beauty & Lifestyle": [
    "Barbers", "Fitness Trainers", "Hairdressers",
    "Makeup Artists", "Nail Technicians", "Stylists",
  ],
  "Media & Events": [
    "DJs", "Event Planners", "Graphic Designers",
    "MCs", "Photographers", "Videographers",
  ],
  "Professional Services": [
    "Accountants", "Consultants", "Lawyers",
    "Translators", "Tutors", "Writers",
  ],
  "IT & Digital Services": [
    "App Developers", "Cybersecurity Experts",
    "Digital Marketers", "Web Developers",
  ],
  "Transport & Logistics": [
    "Couriers", "Drivers", "Fleet Managers", "Mechanics", "Movers",
  ],
};

const SPEC_CATS = Object.keys(SPEC);
const SPEC_SUB_TOTAL = Object.values(SPEC).reduce((n, s) => n + s.length, 0);

const norm = (s: string) => s.trim().toLowerCase();

type Cat = { id: string; name: string };
type Sub = { id: string; name: string; category_id: string };

export default function TaxonomyAuditPage() {
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [c, s] = await Promise.all([
        supabase.from("service_categories").select("id, name").order("name"),
        supabase.from("service_subcategories").select("id, name, category_id").order("name"),
      ]);
      if (!active) return;
      if (c.error) toast.error(`Categories load failed: ${c.error.message}`);
      if (s.error) toast.error(`Subcategories load failed: ${s.error.message}`);
      setCats((c.data as Cat[]) ?? []);
      setSubs((s.data as Sub[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [reloadKey]);

  const report = useMemo(() => {
    const catByName = new Map(cats.map((c) => [norm(c.name), c]));
    const subsByCat = new Map<string, Sub[]>();
    for (const s of subs) {
      const arr = subsByCat.get(s.category_id) ?? [];
      arr.push(s);
      subsByCat.set(s.category_id, arr);
    }

    const rows = SPEC_CATS.map((catName) => {
      const cat = catByName.get(norm(catName));
      const specSubs = SPEC[catName];
      const dbSubs = cat ? subsByCat.get(cat.id) ?? [] : [];
      const dbSubNames = new Set(dbSubs.map((s) => norm(s.name)));
      const missing = specSubs.filter((n) => !dbSubNames.has(norm(n)));
      const extra = dbSubs.map((s) => s.name).filter((n) => !specSubs.some((sn) => norm(sn) === norm(n)));
      return { catName, present: !!cat, id: cat?.id, specSubs, missing, extra, dbCount: dbSubs.length };
    });

    const extraCats = cats
      .map((c) => c.name)
      .filter((n) => !SPEC_CATS.some((sc) => norm(sc) === norm(n)));

    const missingCatCount = rows.filter((r) => !r.present).length;
    const missingSubCount = rows.reduce((n, r) => n + r.missing.length, 0);
    const ok = missingCatCount === 0 && missingSubCount === 0;

    return { rows, extraCats, missingCatCount, missingSubCount, ok };
  }, [cats, subs]);

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const tenantSlug = typeof window !== "undefined"
    ? (window.location.pathname.match(/^\/([^/]+)/)?.[1] ?? "(root)")
    : "";

  const copyReport = () => {
    const lines: string[] = [];
    lines.push(`Taxonomy audit — ${host} — tenant path: ${tenantSlug}`);
    lines.push(`Spec: ${SPEC_CATS.length} categories / ${SPEC_SUB_TOTAL} subcategories`);
    lines.push(`DB:   ${cats.length} categories / ${subs.length} subcategories`);
    lines.push(`Status: ${report.ok ? "PASS" : "FAIL"}`);
    lines.push("");
    for (const r of report.rows) {
      lines.push(`${r.present ? "✓" : "✗"} ${r.catName} — ${r.dbCount}/${r.specSubs.length}`);
      if (r.missing.length) lines.push(`   missing: ${r.missing.join(", ")}`);
      if (r.extra.length) lines.push(`   extra:   ${r.extra.join(", ")}`);
    }
    if (report.extraCats.length) lines.push(`Extra categories: ${report.extraCats.join(", ")}`);
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast.success("Report copied"),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <AdminPage>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading level={1}>Taxonomy Audit</Heading>
            <p className="text-description-sm mt-1">
              Verify the canonical {SPEC_CATS.length} categories and {SPEC_SUB_TOTAL} subcategories exist for this tenant.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={copyReport}>
              <ClipboardList className="mr-2 h-4 w-4" /> Copy report
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  {report.ok ? (
                    <><CheckCircle2 className="h-5 w-5 text-green-600" /> All required taxonomy present</>
                  ) : (
                    <><XCircle className="h-5 w-5 text-destructive" /> Taxonomy incomplete</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <Stat label="Host" value={host || "—"} />
                <Stat label="Tenant path" value={tenantSlug || "—"} />
                <Stat
                  label="Categories"
                  value={`${cats.length} / ${SPEC_CATS.length}`}
                  tone={report.missingCatCount === 0 ? "ok" : "bad"}
                />
                <Stat
                  label="Subcategories"
                  value={`${subs.length} / ${SPEC_SUB_TOTAL}`}
                  tone={report.missingSubCount === 0 ? "ok" : "bad"}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {report.rows.map((r) => (
                <Card key={r.catName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        {r.present ? (
                          r.missing.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {r.catName}
                      </span>
                      <Badge variant={r.present && r.missing.length === 0 ? "secondary" : "destructive"}>
                        {r.dbCount}/{r.specSubs.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {!r.present && (
                      <p className="text-destructive">Category missing from database.</p>
                    )}
                    {r.missing.length > 0 && (
                      <div>
                        <p className="font-medium text-destructive">Missing subcategories</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.missing.map((m) => (
                            <Badge key={m} variant="destructive">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.extra.length > 0 && (
                      <div>
                        <p className="font-medium text-muted-foreground">Extra (not in spec)</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.extra.map((m) => (
                            <Badge key={m} variant="outline">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.present && r.missing.length === 0 && r.extra.length === 0 && (
                      <p className="text-muted-foreground">All {r.specSubs.length} subcategories present.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {report.extraCats.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Extra categories not in spec
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1">
                  {report.extraCats.map((n) => (
                    <Badge key={n} variant="outline">{n}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminPage>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 font-semibold " +
          (tone === "ok" ? "text-green-600" : tone === "bad" ? "text-destructive" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
