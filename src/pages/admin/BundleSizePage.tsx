import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

type SizeBucket = { raw: number; gz: number };
type Entry = {
  id: string;
  ref: string;
  pr: number | null;
  commit: string;
  message: string;
  timestamp: string;
  sizes: { js: SizeBucket; css: SizeBucket; total: SizeBucket };
};
type History = { entries: Entry[] };

// Regression threshold (matches CI default tolerance in scripts/check-bundle-size.mjs)
const TOLERANCE = 0.03;

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function fmtDelta(bytes: number): string {
  const sign = bytes > 0 ? "+" : bytes < 0 ? "" : "±";
  return `${sign}${(bytes / 1024).toFixed(2)} KB`;
}

function pct(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return (curr - prev) / prev;
}

function statusFor(deltaPct: number): "regression" | "improvement" | "neutral" {
  if (deltaPct > TOLERANCE) return "regression";
  if (deltaPct < -0.005) return "improvement";
  return "neutral";
}

export default function BundleSizePage() {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/bundle-size-history.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load history (${r.status})`);
        return r.json() as Promise<History>;
      })
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!history) return [];
    return history.entries.map((entry, i) => {
      const prev = i > 0 ? history.entries[i - 1] : null;
      const totalDelta = prev ? entry.sizes.total.gz - prev.sizes.total.gz : 0;
      const totalPct = prev ? pct(entry.sizes.total.gz, prev.sizes.total.gz) : 0;
      const jsDelta = prev ? entry.sizes.js.gz - prev.sizes.js.gz : 0;
      const jsPct = prev ? pct(entry.sizes.js.gz, prev.sizes.js.gz) : 0;
      const cssDelta = prev ? entry.sizes.css.gz - prev.sizes.css.gz : 0;
      const cssPct = prev ? pct(entry.sizes.css.gz, prev.sizes.css.gz) : 0;
      return {
        entry,
        prev,
        totalDelta,
        totalPct,
        jsDelta,
        jsPct,
        cssDelta,
        cssPct,
        status: statusFor(totalPct),
      };
    });
  }, [history]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        label: r.entry.pr ? `#${r.entry.pr}` : r.entry.id,
        js: +(r.entry.sizes.js.gz / 1024).toFixed(2),
        css: +(r.entry.sizes.css.gz / 1024).toFixed(2),
        total: +(r.entry.sizes.total.gz / 1024).toFixed(2),
      })),
    [rows],
  );

  const regressions = rows.filter((r) => r.status === "regression");
  const latest = rows.at(-1);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(rows, 20);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Could not load bundle history</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!history) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Heading level={1} >Bundle Size</Heading>
        <p className="text-description-sm mt-1">
          Per-PR bundle size deltas. Regressions exceed ±{(TOLERANCE * 100).toFixed(0)}% gzipped total versus previous build.
        </p>
      </div>

      {regressions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{regressions.length} regression{regressions.length > 1 ? "s" : ""} detected</AlertTitle>
          <AlertDescription>
            {regressions.slice(-3).map((r) => (
              <div key={r.entry.id} className="text-fs-sm">
                {r.entry.pr ? `PR #${r.entry.pr}` : r.entry.id} — {r.entry.message} ({fmtDelta(r.totalDelta)},{" "}
                {(r.totalPct * 100).toFixed(2)}%)
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Latest gzipped total"
          value={latest ? fmtKB(latest.entry.sizes.total.gz) : "—"}
          delta={latest && latest.prev ? fmtDelta(latest.totalDelta) : null}
          deltaPct={latest && latest.prev ? latest.totalPct : null}
        />
        <StatCard
          title="JavaScript (gz)"
          value={latest ? fmtKB(latest.entry.sizes.js.gz) : "—"}
          delta={latest && latest.prev ? fmtDelta(latest.jsDelta) : null}
          deltaPct={latest && latest.prev ? latest.jsPct : null}
        />
        <StatCard
          title="CSS (gz)"
          value={latest ? fmtKB(latest.entry.sizes.css.gz) : "—"}
          delta={latest && latest.prev ? fmtDelta(latest.cssDelta) : null}
          deltaPct={latest && latest.prev ? latest.cssPct : null}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-fs-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Trend (gzipped, KB)
          </CardTitle>
          <CardDescription>Each point is one merged build.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="js" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                <Line
                  type="monotone"
                  dataKey="css"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-fs-lg">Per-PR history</CardTitle>
          <CardDescription>Most recent at the bottom. Highlighted rows exceed the regression budget.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR</TableHead>
                <TableHead>Branch / message</TableHead>
                <TableHead className="text-right">Total (gz)</TableHead>
                <TableHead className="text-right">Δ Total</TableHead>
                <TableHead className="text-right">Δ JS</TableHead>
                <TableHead className="text-right">Δ CSS</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((r) => (
                <TableRow
                  key={r.entry.id}
                  className={cn(r.status === "regression" && "bg-destructive/5 hover:bg-destructive/10")}
                >
                  <TableCell className="font-mono text-fs-xs">
                    {r.entry.pr ? `#${r.entry.pr}` : "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="font-medium text-fs-sm truncate">{r.entry.message}</div>
                    <div className="text-fs-xs text-muted-foreground truncate">
                      {r.entry.ref} · {r.entry.commit.slice(0, 7)} ·{" "}
                      {new Date(r.entry.timestamp).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-fs-xs">
                    {fmtKB(r.entry.sizes.total.gz)}
                  </TableCell>
                  <DeltaCell delta={r.totalDelta} pctValue={r.totalPct} hasPrev={!!r.prev} />
                  <DeltaCell delta={r.jsDelta} pctValue={r.jsPct} hasPrev={!!r.prev} />
                  <DeltaCell delta={r.cssDelta} pctValue={r.cssPct} hasPrev={!!r.prev} />
                  <TableCell>
                    <StatusBadge status={r.status} hasPrev={!!r.prev} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={pageSize}
              className="mt-4"
          onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  delta,
  deltaPct,
}: {
  title: string;
  value: string;
  delta: string | null;
  deltaPct: number | null;
}) {
  const status = deltaPct === null ? "neutral" : statusFor(deltaPct);
  const tone =
    status === "regression"
      ? "text-destructive"
      : status === "improvement"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-fs-2xl font-mono">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        {delta !== null && deltaPct !== null ? (
          <div className={cn("flex items-center gap-1 text-fs-sm font-medium", tone)}>
            {status === "regression" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : status === "improvement" ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            {delta} ({(deltaPct * 100).toFixed(2)}%)
          </div>
        ) : (
          <div className="text-fs-sm text-muted-foreground">No previous build</div>
        )}
      </CardContent>
    </Card>
  );
}

function DeltaCell({ delta, pctValue, hasPrev }: { delta: number; pctValue: number; hasPrev: boolean }) {
  if (!hasPrev) {
    return <TableCell className="text-right text-fs-xs text-muted-foreground">—</TableCell>;
  }
  const status = statusFor(pctValue);
  const tone =
    status === "regression"
      ? "text-destructive font-semibold"
      : status === "improvement"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <TableCell className={cn("text-right font-mono text-fs-xs", tone)}>
      {fmtDelta(delta)}
      <span className="ml-1 opacity-70">({(pctValue * 100).toFixed(2)}%)</span>
    </TableCell>
  );
}

function StatusBadge({ status, hasPrev }: { status: "regression" | "improvement" | "neutral"; hasPrev: boolean }) {
  if (!hasPrev) return <Badge variant="outline">baseline</Badge>;
  if (status === "regression") return <Badge variant="destructive">regression</Badge>;
  if (status === "improvement") return <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-transparent">improved</Badge>;
  return <Badge variant="secondary">stable</Badge>;
}
