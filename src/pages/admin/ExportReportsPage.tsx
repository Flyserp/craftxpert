import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Heading } from "@/components/ui/app";

type Dataset =
  | "revenue"
  | "customers"
  | "providers"
  | "employers"
  | "jobs"
  | "reviews"
  | "subscriptions"
  | "verifications"
  | "sponsored";

type Format = "csv" | "xlsx" | "pdf";

const datasets: { value: Dataset; label: string; description: string }[] = [
  { value: "revenue", label: "Revenue", description: "Successful payment transactions" },
  { value: "jobs", label: "Jobs", description: "Posted tasks / jobs" },
  { value: "providers", label: "Providers", description: "Service providers" },
  { value: "employers", label: "Employers", description: "Employer accounts" },
  { value: "customers", label: "Customers", description: "Registered customers" },
  { value: "reviews", label: "Reviews", description: "Customer reviews and ratings" },
  { value: "verifications", label: "Verification Requests", description: "Vendor verification submissions" },
  { value: "sponsored", label: "Sponsored Services", description: "Sponsored service orders" },
  { value: "subscriptions", label: "Subscriptions", description: "Provider subscriptions" },
];

async function fetchDataset(ds: Dataset, from?: string, to?: string): Promise<Record<string, any>[]> {
  const applyRange = (q: any, col = "created_at") => {
    if (from) q = q.gte(col, from);
    if (to) q = q.lte(col, to + "T23:59:59");
    return q;
  };

  if (ds === "customers" || ds === "providers" || ds === "employers") {
    const roleMap: Record<string, string> = {
      customers: "customer",
      providers: "provider",
      employers: "employer",
    };
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", roleMap[ds] as any);
    if (rErr) throw rErr;
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    let q: any = supabase
      .from("profiles")
      .select("user_id,display_name,phone,address,business_name,status,created_at")
      .in("user_id", ids);
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (ds === "jobs") {
    let q: any = supabase
      .from("tasks")
      .select("id,title,status,budget_min,budget_max,preferred_date,customer_id,created_at");
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (ds === "revenue") {
    let q: any = supabase
      .from("payment_transactions")
      .select("id,user_id,vendor_id,amount,payment_method,payment_type,status,created_at")
      .in("status", ["succeeded", "completed", "paid"]);
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (ds === "reviews") {
    let q: any = supabase
      .from("reviews")
      .select("id,booking_id,customer_id,vendor_id,rating,comment,created_at");
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (ds === "sponsored") {
    let q: any = supabase
      .from("sponsorship_orders")
      .select("id,vendor_id,service_id,days,amount,starts_at,ends_at,created_at");
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (ds === "subscriptions") {
    let q: any = supabase
      .from("provider_subscriptions")
      .select("id,provider_id,plan_id,status,current_period_start,current_period_end,created_at");
    q = applyRange(q);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  // verifications
  let q: any = supabase
    .from("vendor_verifications")
    .select("id,vendor_id,business_name,status,expires_at,submitted_at,reviewed_at,created_at");
  q = applyRange(q);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportReportsPage() {
  const [dataset, setDataset] = useState<Dataset>("revenue");
  const [format, setFormat] = useState<Format>("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async (fmt?: Format) => {
    const useFmt = fmt ?? format;
    setLoading(true);
    try {
      const rows = await fetchDataset(dataset, from || undefined, to || undefined);
      if (!rows.length) {
        toast.info("No data to export for the selected filters.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const base = `${dataset}-${stamp}`;

      if (useFmt === "csv") {
        download(new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else if (useFmt === "xlsx") {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet(dataset);
        const headers = Object.keys(rows[0]);
        ws.addRow(headers);
        rows.forEach((r) => ws.addRow(headers.map((h) => {
          const v = r[h];
          return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
        })));
        const buf = await wb.xlsx.writeBuffer();
        download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: "landscape" });
        const headers = Object.keys(rows[0]);
        doc.setFontSize(14);
        doc.text(`Report: ${dataset}`, 14, 14);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}  •  ${rows.length} rows`, 14, 20);
        autoTable(doc, {
          startY: 26,
          head: [headers],
          body: rows.map((r) => headers.map((h) => {
            const v = r[h];
            return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
          })),
          styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
          headStyles: { fillColor: [0, 41, 46] },
        });
        doc.save(`${base}.pdf`);
      }

      toast.success(`Exported ${rows.length} rows as ${useFmt.toUpperCase()}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Heading level={1} >Export Reports</Heading>
        <p className="text-description-sm">Download platform data as CSV, Excel, or PDF.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build report</CardTitle>
          <CardDescription>Pick a dataset, optional date range, and a format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Dataset</Label>
              <Select value={dataset} onValueChange={(v) => setDataset(v as Dataset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label} — {d.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => handleExport("csv")} disabled={loading} variant="outline">
              <FileText className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button onClick={() => handleExport("xlsx")} disabled={loading} variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={() => handleExport("pdf")} disabled={loading} variant="outline">
              <FileType className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick exports</CardTitle>
          <CardDescription>One-click CSV for each dataset.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((d) => (
              <div key={d.value} className="flex items-center justify-between rounded-sm border p-3">
                <div>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-description-sm">{d.description}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={async () => { setDataset(d.value); setFormat("csv"); await handleExport("csv"); }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}