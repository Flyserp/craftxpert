import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  RotateCcw, Plus, Loader2, Clock, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Heading } from "@/components/ui/app";

interface RefundRequest {
  id: string;
  booking_id: string;
  amount: number;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface BookingOption {
  id: string;
  total_price: number | null;
  booking_date: string;
  status: string;
}

export default function RefundRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(requests, 10);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [refundsRes, bookingsRes] = await Promise.all([
        supabase
          .from("refund_requests")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, total_price, booking_date, status")
          .eq("customer_id", user.id)
          .in("status", ["completed", "confirmed", "accepted"]),
      ]);
      setRequests(refundsRes.data || []);
      setBookings(bookingsRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!selectedBooking || !amount || !reason.trim() || !user) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("refund_requests").insert({
      booking_id: selectedBooking,
      customer_id: user.id,
      amount: parseFloat(amount),
      reason: reason.trim(),
    });

    if (error) {
      toast.error("Failed to submit request");
    } else {
      toast.success("Refund request submitted");
      setOpen(false);
      setSelectedBooking("");
      setAmount("");
      setReason("");
      // Reload
      const { data } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      setRequests(data || []);
    }
    setSubmitting(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      case "approved": case "processed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    processed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20 sm:pb-8">
      <UnifiedHeader />
      <main className="container-app max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Heading level={1}  className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary" />
            Refund Requests
          </Heading>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a Refund</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-fs-sm font-medium text-heading mb-1.5 block">Select Booking</label>
                  <select
                    value={selectedBooking}
                    onChange={(e) => {
                      setSelectedBooking(e.target.value);
                      const b = bookings.find((bk) => bk.id === e.target.value);
                      if (b?.total_price) setAmount(String(b.total_price));
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-fs-sm"
                  >
                    <option value="">Choose a booking...</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {format(new Date(b.booking_date), "MMM d, yyyy")} — ${b.total_price || 0} ({b.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-fs-sm font-medium text-heading mb-1.5 block">Refund Amount ($)</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-fs-sm font-medium text-heading mb-1.5 block">Reason</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why you'd like a refund..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RotateCcw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-description-sm">No refund requests yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pageItems.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      {statusIcon(req.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColors[req.status] || "bg-muted"}`}>
                          {req.status}
                        </span>
                        <span className="text-fs-xs text-muted-foreground">
                          {format(new Date(req.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-fs-sm text-heading font-medium mb-1">${req.amount.toFixed(2)} refund requested</p>
                      <p className="text-fs-xs text-muted-foreground">{req.reason}</p>
                      {req.admin_notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          <p className="text-[13px] font-medium text-heading mb-0.5">Admin Response:</p>
                          <p className="text-fs-xs text-muted-foreground">{req.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={pageSize}
          onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </main>
      
    </div>
  );
}
