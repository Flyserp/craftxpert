import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, ChevronDown, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Canonical taxonomy that every tenant/domain must expose. These names are the
 * shared marketplace taxonomy — regardless of which tenant slug or custom
 * domain the visitor lands on, the browsing surface and admin Categories
 * management screen must be able to see all six categories.
 *
 * If this list changes (categories added/removed), update it here so the
 * verification badge keeps warning admins about tenants that don't return the
 * full set.
 */
const EXPECTED_CATEGORIES: readonly string[] = [
  "Home Services",
  "Beauty & Lifestyle",
  "Media & Events",
  "Professional Services",
  "IT & Digital Services",
  "Transport & Logistics",
];

type Row = { id: string; name: string };
type SubRow = { id: string; category_id: string };

type Props = {
  /**
   * Where the check is being rendered. Controls copy — the admin variant is
   * always visible; the public variant only surfaces when something is wrong
   * (or the QA flag `?taxonomy-check=1` is set) so end users never see the
   * diagnostic.
   */
  variant?: "admin" | "public";
  className?: string;
};

export default function TaxonomyVisibilityCheck({
  variant = "admin",
  className,
}: Props) {
  const [cats, setCats] = useState<Row[] | null>(null);
  const [subs, setSubs] = useState<SubRow[] | null>(null);
  const [expanded, setExpanded] = useState(variant === "admin");
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    let active = true;
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("service_categories").select("id, name"),
        supabase.from("service_subcategories").select("id, category_id"),
      ]);
      if (!active) return;
      setCats((c.data as Row[]) ?? []);
      setSubs((s.data as SubRow[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const tenantSlug = useMemo(() => {
    const fromParams = (params as any)?.tenant || (params as any)?.tenantSlug;
    if (fromParams) return String(fromParams);
    // Fall back to the first path segment for the memory's `/:tenant-slug` scheme.
    const seg = location.pathname.split("/").filter(Boolean)[0];
    // Ignore well-known top-level app routes so we don't misreport them as tenants.
    const reserved = new Set([
      "admin",
      "browse",
      "category",
      "auth",
      "login",
      "signup",
      "dashboard",
      "provider",
      "employer",
      "customer",
      "search",
      "post-task",
      "my-bookings",
    ]);
    return seg && !reserved.has(seg) ? seg : null;
  }, [location.pathname, params]);

  const host =
    typeof window !== "undefined" ? window.location.hostname : "server";

  const report = useMemo(() => {
    if (!cats || !subs) return null;
    const visibleNames = new Set(cats.map((c) => c.name));
    const missing = EXPECTED_CATEGORIES.filter((n) => !visibleNames.has(n));
    const extra = cats.filter((c) => !EXPECTED_CATEGORIES.includes(c.name));
    const subCountByCat = new Map<string, number>();
    subs.forEach((s) =>
      subCountByCat.set(s.category_id, (subCountByCat.get(s.category_id) ?? 0) + 1),
    );
    const perCategory = EXPECTED_CATEGORIES.map((name) => {
      const row = cats.find((c) => c.name === name);
      return {
        name,
        visible: !!row,
        subcategoryCount: row ? subCountByCat.get(row.id) ?? 0 : 0,
      };
    });
    return {
      missing,
      extra,
      perCategory,
      totalVisible: cats.length,
      totalExpected: EXPECTED_CATEGORIES.length,
      totalSubcategories: subs.length,
    };
  }, [cats, subs]);

  const qaForced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("taxonomy-check") === "1";

  if (!report) {
    if (variant === "public" && !qaForced) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-fs-xs text-muted-foreground bg-card border border-border rounded-sm px-3 py-2",
          className,
        )}
        aria-live="polite"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Verifying taxonomy visibility…
      </div>
    );
  }

  const ok = report.missing.length === 0;

  // Public variant stays hidden when everything is fine and QA flag is off.
  if (variant === "public" && ok && !qaForced) return null;

  const tone = ok
    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
    : "border-destructive/30 bg-destructive/5 text-destructive";

  return (
    <section
      className={cn("rounded-sm border px-4 py-3", tone, className)}
      role="status"
      aria-live="polite"
      data-testid="taxonomy-visibility-check"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        {ok ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        )}
        <span className="text-fs-sm font-semibold">
          {ok
            ? `Full taxonomy visible (${report.totalVisible}/${report.totalExpected} categories, ${report.totalSubcategories} subcategories)`
            : `${report.missing.length} categor${report.missing.length === 1 ? "y" : "ies"} missing on this tenant/domain`}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-normal opacity-80">
          <Globe className="w-3 h-3" />
          {host}
          {tenantSlug ? ` · /${tenantSlug}` : " · (root)"}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </span>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {report.perCategory.map((c) => (
            <div
              key={c.name}
              className={cn(
                "flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-fs-xs bg-background",
                c.visible ? "border-border" : "border-destructive/40",
              )}
            >
              {c.visible ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              )}
              <span className="truncate text-body">{c.name}</span>
              <span className="ml-auto text-muted-foreground">
                {c.visible ? `${c.subcategoryCount} subs` : "missing"}
              </span>
            </div>
          ))}
          {report.extra.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3 text-[11px] text-muted-foreground">
              Extra (not in canonical set):{" "}
              {report.extra.map((e) => e.name).join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
