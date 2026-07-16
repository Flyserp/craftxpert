import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Receipt, Download, FileText, Loader2, Search, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  booking_id: string | null;
  pdf_url: string | null;
  created_at: string;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    issued: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    refunded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
};

export default function MyInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) toast.error("Could not load invoices");
      setInvoices(data || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const handleDownload = (inv: Invoice) => {
    if (inv.pdf_url) {
      window.open(inv.pdf_url, "_blank", "noopener,noreferrer");
      return;
    }
    // Fallback: client-rendered printable invoice
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Please allow pop-ups to download invoices");
      return;
    }
    const dateStr = inv.issued_at
      ? format(new Date(inv.issued_at), "MMMM d, yyyy")
      : format(new Date(inv.created_at), "MMMM d, yyyy");
    win.document.write(`
      <html><head><title>Invoice ${inv.invoice_number}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #111; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 14px; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; font-size: 12px; text-transform: uppercase; color: #888; }
        .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 16px; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Invoice</h1>
      <p class="meta">${inv.invoice_number}</p>
      <p class="meta">Date: ${dateStr}</p>
      <p class="meta">Status: ${inv.status}</p>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Service charge</td><td style="text-align:right">$${inv.amount.toFixed(2)}</td></tr>
          <tr><td>Tax</td><td style="text-align:right">$${inv.tax_amount.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p class="total">Total: $${inv.total_amount.toFixed(2)}</p>
      <p class="footer">Thank you for your business.</p>
      <script>window.print();</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20 sm:pb-8">
      <UnifiedHeader />
      <main className="container-app max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Heading level={1}  className="flex items-center gap-2">
              <Receipt className="w-6 h-6 text-primary" />
              Receipts &amp; Invoices
            </Heading>
            <p className="text-description-sm mt-1">
              Download PDFs of your past payments for your records.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoice number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-description-sm">
                {invoices.length === 0
                  ? "You don't have any invoices yet."
                  : "No invoices match your search."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pageItems.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-fs-sm font-medium text-heading font-mono">
                        {inv.invoice_number}
                      </p>
                      {statusBadge(inv.status)}
                    </div>
                    <p className="text-fs-xs text-muted-foreground mt-0.5">
                      {inv.issued_at
                        ? format(new Date(inv.issued_at), "MMM d, yyyy")
                        : format(new Date(inv.created_at), "MMM d, yyyy")}
                      {inv.booking_id && (
                        <>
                          {" • "}
                          <Link
                            to={`/my-bookings/${inv.booking_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            Booking <ExternalLink className="w-3 h-3" />
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-fs-sm font-bold tabular-nums text-heading">
                      ${inv.total_amount.toFixed(2)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleDownload(inv)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={setPage}
              pageSize={pageSize}
          onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </main>
    </div>
  );
}
