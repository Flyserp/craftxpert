import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SLA_HOURS: Record<string, number> = {
  verification: 48,
  report: 24,
  dispute: 24,
  refund: 72,
};

type Row = {
  case_id: string;
  kind: string;
  tenant: string;
  category: string;
  status: string;
  decision: string;
  opened_at: string;
  resolved_at: string | null;
  due_at: string;
  sla_outcome: "on_time" | "overdue" | "pending_ok" | "pending_overdue";
  resolution_hours: number | null;
};

function fmtOutcome(o: Row["sla_outcome"]) {
  return {
    on_time: "On-time",
    overdue: "Overdue",
    pending_ok: "Pending (within SLA)",
    pending_overdue: "Pending (overdue)",
  }[o];
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchRows(fromISO: string, toISO: string): Promise<Row[]> {
  const sb = supabase as any;
  const [ver, rep, dis, ref] = await Promise.all([
    sb.from("vendor_verifications")
      .select("id, status, submitted_at, created_at, reviewed_at")
      .gte("created_at", fromISO).lte("created_at", toISO).limit(5000),
    sb.from("content_reports")
      .select("id, entity_type, status, created_at, reviewed_at")
      .gte("created_at", fromISO).lte("created_at", toISO).limit(5000),
    sb.from("disputes")
      .select("id, type, status, priority, created_at, resolved_at")
      .gte("created_at", fromISO).lte("created_at", toISO).limit(5000),
    sb.from("refund_requests")
      .select("id, status, created_at, reviewed_at")
      .gte("created_at", fromISO).lte("created_at", toISO).limit(5000),
  ]);

  const now = Date.now();
  const build = (kind: string, opened: string, resolved: string | null, status: string, category: string): Row => {
    const openedMs = new Date(opened).getTime();
    const dueMs = openedMs + SLA_HOURS[kind] * 3600_000;
    const resolvedMs = resolved ? new Date(resolved).getTime() : null;
    let outcome: Row["sla_outcome"];
    if (resolvedMs != null) outcome = resolvedMs <= dueMs ? "on_time" : "overdue";
    else outcome = now <= dueMs ? "pending_ok" : "pending_overdue";
    const isDecided = resolvedMs != null;
    return {
      case_id: "",
      kind,
      tenant: "Platform",
      category,
      status,
      decision: isDecided ? status : "pending",
      opened_at: opened,
      resolved_at: resolved,
      due_at: new Date(dueMs).toISOString(),
      sla_outcome: outcome,
      resolution_hours: resolvedMs != null ? +((resolvedMs - openedMs) / 3600_000).toFixed(2) : null,
    };
  };

  const rows: Row[] = [];
  (ver.data || []).forEach((r: any) => {
    const opened = r.submitted_at || r.created_at;
    rows.push({ ...build("verification", opened, r.reviewed_at, r.status, "Vendor Verification"), case_id: r.id });
  });
  (rep.data || []).forEach((r: any) => {
    rows.push({ ...build("report", r.created_at, r.reviewed_at, r.status, r.entity_type || "content"), case_id: r.id });
  });
  (dis.data || []).forEach((r: any) => {
    rows.push({ ...build("dispute", r.created_at, r.resolved_at, r.status, r.type || "dispute"), case_id: r.id });
  });
  (ref.data || []).forEach((r: any) => {
    rows.push({ ...build("refund", r.created_at, r.reviewed_at, r.status, "Refund"), case_id: r.id });
  });

  rows.sort((a, b) => (a.opened_at < b.opened_at ? 1 : -1));
  return rows;
}

function summarize(rows: Row[]) {
  const groups = new Map<string, { tenant: string; category: string; total: number; onTime: number; overdue: number; pending: number; sumRes: number; countRes: number }>();
  for (const r of rows) {
    const key = `${r.tenant}||${r.category}`;
    const g = groups.get(key) || { tenant: r.tenant, category: r.category, total: 0, onTime: 0, overdue: 0, pending: 0, sumRes: 0, countRes: 0 };
    g.total++;
    if (r.sla_outcome === "on_time") g.onTime++;
    else if (r.sla_outcome === "overdue") g.overdue++;
    else g.pending++;
    if (r.resolution_hours != null) { g.sumRes += r.resolution_hours; g.countRes++; }
    groups.set(key, g);
  }
  return Array.from(groups.values()).map((g) => ({
    tenant: g.tenant,
    category: g.category,
    total: g.total,
    on_time: g.onTime,
    overdue: g.overdue,
    pending: g.pending,
    avg_resolution_hours: g.countRes ? +(g.sumRes / g.countRes).toFixed(2) : null,
  }));
}

export function ModerationReports() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [busy, setBusy] = useState<null | "csv" | "pdf">(null);

  const run = async (format: "csv" | "pdf") => {
    setBusy(format);
    try {
      const fromISO = new Date(from + "T00:00:00Z").toISOString();
      const toISO = new Date(to + "T23:59:59Z").toISOString();
      const rows = await fetchRows(fromISO, toISO);
      if (rows.length === 0) {
        toast({ title: "No data", description: "No moderation activity in the selected range." });
        return;
      }
      const summary = summarize(rows);
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === "csv") {
        const headers = [
          "case_id","kind","tenant","category","status","decision",
          "opened_at","resolved_at","due_at","sla_outcome","resolution_hours",
        ];
        const detail = [headers.join(",")]
          .concat(rows.map((r) => headers.map((h) => csvEscape((r as any)[h])).join(",")))
          .join("\n");
        const sumHeaders = ["tenant","category","total","on_time","overdue","pending","avg_resolution_hours"];
        const summaryCsv = [sumHeaders.join(",")]
          .concat(summary.map((s) => sumHeaders.map((h) => csvEscape((s as any)[h])).join(",")))
          .join("\n");
        const combined = `# Moderation Report ${from} to ${to}\n# Summary by tenant + category\n${summaryCsv}\n\n# Detail\n${detail}\n`;
        downloadBlob(combined, "text/csv;charset=utf-8", `moderation-report_${from}_to_${to}_${stamp}.csv`);
      } else {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        doc.setFontSize(16);
        doc.text("Moderation Inbox Report", 40, 40);
        doc.setFontSize(10);
        doc.text(`Range: ${from} → ${to}   Generated: ${stamp}   Cases: ${rows.length}`, 40, 58);

        autoTable(doc, {
          startY: 76,
          head: [["Tenant", "Category", "Total", "On-time", "Overdue", "Pending", "Avg resolution (h)"]],
          body: summary.map((s) => [s.tenant, s.category, s.total, s.on_time, s.overdue, s.pending, s.avg_resolution_hours ?? "—"]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [0, 39, 44] },
        });

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 24,
          head: [["Case ID", "Kind", "Category", "Decision", "Opened", "Resolved", "SLA", "Res. (h)"]],
          body: rows.map((r) => [
            r.case_id.slice(0, 8),
            r.kind,
            r.category,
            r.decision,
            r.opened_at.slice(0, 16).replace("T", " "),
            r.resolved_at ? r.resolved_at.slice(0, 16).replace("T", " ") : "—",
            fmtOutcome(r.sla_outcome),
            r.resolution_hours ?? "—",
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [0, 39, 44] },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 6) {
              const v = String(data.cell.raw);
              if (v.startsWith("Overdue") || v === "Pending (overdue)") {
                data.cell.styles.textColor = [200, 30, 30];
              } else if (v === "On-time") {
                data.cell.styles.textColor = [22, 130, 60];
              }
            }
          },
        });

        doc.save(`moderation-report_${from}_to_${to}_${stamp}.pdf`);
      }
      toast({ title: "Report ready", description: `${rows.length} cases exported.` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Reports
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Moderation Reports</DialogTitle>
          <DialogDescription>
            Export decisions, SLA outcomes (on-time / overdue) and resolution times per tenant and category.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rep-from">From</Label>
            <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-to">To</Label>
            <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Includes verifications, content reports, disputes and refund requests opened in the range.
          Pending cases are included with their current SLA status.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => run("csv")}>
            {busy === "csv" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Download CSV
          </Button>
          <Button disabled={!!busy} onClick={() => run("pdf")}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
