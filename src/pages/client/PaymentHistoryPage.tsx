import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Receipt, Download, FileText, CreditCard, Wallet, Building2,
  Loader2, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Heading } from "@/components/ui/app";

interface PaymentTx {
  id: string;
  booking_id: string | null;
  amount: number;
  payment_method: string;
  payment_type: string;
  status: string;
  created_at: string;
  metadata: any;
}

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
  created_at: string;
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentTx[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const paymentsPg = usePagination(payments, 10);
  const invoicesPg = usePagination(invoices, 10);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      let pq = supabase
        .from("payment_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      let iq = supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      {
        pq = pq.eq("user_id", user.id);
        iq = iq.eq("customer_id", user.id);
      }
      const [paymentsRes, invoicesRes] = await Promise.all([pq, iq]);
      setPayments(paymentsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const methodIcon = (method: string) => {
    switch (method) {
      case "stripe": case "card": return <CreditCard className="w-4 h-4" />;
      case "paypal": return <CreditCard className="w-4 h-4 text-blue-600" />;
      case "wallet": return <Wallet className="w-4 h-4 text-primary" />;
      case "bank": return <Building2 className="w-4 h-4 text-emerald-600" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      refunded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      issued: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${colors[status] || colors.draft}`}>
        {status}
      </span>
    );
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    // Generate a printable invoice in a new window
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; font-size: 12px; text-transform: uppercase; color: #888; }
        .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 16px; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Invoice</h1>
      <p class="meta">${invoice.invoice_number}</p>
      <p class="meta">Date: ${invoice.issued_at ? format(new Date(invoice.issued_at), "MMMM d, yyyy") : format(new Date(invoice.created_at), "MMMM d, yyyy")}</p>
      <p class="meta">Status: ${invoice.status}</p>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Service charge</td><td style="text-align:right">$${invoice.amount.toFixed(2)}</td></tr>
          <tr><td>Tax</td><td style="text-align:right">$${invoice.tax_amount.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p class="total">Total: $${invoice.total_amount.toFixed(2)}</p>
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
        <Heading level={1}  className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-primary" />
          Payments & Invoices
        </Heading>

        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="payments" className="flex-1 gap-1.5">
              <CreditCard className="w-4 h-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1 gap-1.5">
              <FileText className="w-4 h-4" /> Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-description-sm">No payment transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {paymentsPg.pageItems.map((tx) => (
                  <Card key={tx.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
                        {methodIcon(tx.payment_method)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-fs-sm font-medium text-heading capitalize">
                            {tx.payment_method} • {tx.payment_type}
                          </p>
                          {statusBadge(tx.status)}
                        </div>
                        <p className="text-fs-xs text-muted-foreground mt-0.5">
                          {format(new Date(tx.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <p className="text-fs-sm font-bold tabular-nums text-heading shrink-0">
                        ${tx.amount.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                <NumberedPagination
                  currentPage={paymentsPg.page}
                  totalPages={paymentsPg.totalPages}
                  onPageChange={paymentsPg.setPage}
                  totalItems={paymentsPg.totalItems}
                  pageSize={paymentsPg.pageSize}
          onPageSizeChange={paymentsPg.setPageSize}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : invoices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-description-sm">No invoices yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {invoicesPg.pageItems.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-fs-sm font-medium text-heading font-mono">
                            {inv.invoice_number}
                          </p>
                          {statusBadge(inv.status)}
                        </div>
                        <p className="text-fs-xs text-muted-foreground mt-0.5">
                          {inv.issued_at
                            ? format(new Date(inv.issued_at), "MMM d, yyyy")
                            : format(new Date(inv.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-fs-sm font-bold tabular-nums text-heading">
                          ${inv.total_amount.toFixed(2)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleDownloadInvoice(inv)}
                          title="Download PDF"
                          aria-label={`Download invoice ${inv.invoice_number} PDF`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <NumberedPagination
                  currentPage={invoicesPg.page}
                  totalPages={invoicesPg.totalPages}
                  onPageChange={invoicesPg.setPage}
                  totalItems={invoicesPg.totalItems}
                  pageSize={invoicesPg.pageSize}
          onPageSizeChange={invoicesPg.setPageSize}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
