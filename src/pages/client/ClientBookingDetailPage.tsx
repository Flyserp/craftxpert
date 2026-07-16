import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarCheck, Clock, MapPin, MessageSquare, X,
  CalendarClock, Wallet, Star, FileText, BadgeCheck, Receipt, ShieldCheck,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import CancelBookingModal from "@/components/booking/CancelBookingModal";
import ProposeRescheduleModal from "@/components/booking/ProposeRescheduleModal";
import RescheduleApprovalCard from "@/components/booking/RescheduleApprovalCard";
import DownloadReceiptButton from "@/components/booking/DownloadReceiptButton";
import BookingTimeline from "@/components/booking/BookingTimeline";
import { evaluateBookingPolicy, formatTimeUntil } from "@/lib/bookingPolicy";
import { cancelBookingWithRefund } from "@/lib/bookingActions";
import {
  proposeReschedule, approveReschedule, declineReschedule,
  cancelRescheduleRequest, getPendingRescheduleRequest,
} from "@/lib/rescheduleRequests";
import ReportIssueModal from "@/components/disputes/ReportIssueModal";
import CommissionBreakdown from "@/components/booking/CommissionBreakdown";

interface BookingFull {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  accepted: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  confirmed: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
  reschedule_requested: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

export default function ClientBookingDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<BookingFull | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorAvatar, setVendorAvatar] = useState<string | null>(null);
  const [vendorAddress, setVendorAddress] = useState<string | null>(null);
  const [serviceTitle, setServiceTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user || !bookingId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, payment_status, total_price, subtotal, tax_amount, discount_amount, notes, created_at, updated_at")
      .eq("id", bookingId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (error || !data) {
      toast.error("Booking not found");
      navigate("/my-bookings", { replace: true });
      return;
    }
    setBooking(data as BookingFull);

    const [vendorRes, serviceRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, address").eq("user_id", data.vendor_id).maybeSingle(),
      supabase.from("vendor_services").select("title").eq("id", data.service_id).maybeSingle(),
    ]);
    setVendorName(vendorRes.data?.display_name || "Provider");
    setVendorAvatar(vendorRes.data?.avatar_url || null);
    setVendorAddress(vendorRes.data?.address || null);
    setServiceTitle(serviceRes.data?.title || "Service");
    setLoading(false);
  }, [user, bookingId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Load any pending reschedule request whenever the booking changes.
  useEffect(() => {
    if (!booking) { setPendingRequest(null); return; }
    getPendingRescheduleRequest(booking.id).then(setPendingRequest);
  }, [booking?.id, booking?.status]);

  if (loading || !booking) {
    return (
      <DashboardLayout title="Booking" subtitle="Loading…">
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-sm" />
          <Skeleton className="h-48 w-full rounded-sm" />
        </div>
      </DashboardLayout>
    );
  }

  const paid =
    booking.payment_status === "paid" || booking.payment_status === "deposit_paid"
      ? Number(booking.total_price ?? 0)
      : 0;
  const policy = evaluateBookingPolicy({
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    status: booking.status,
    paidAmount: paid,
  });

  const startDate = new Date(`${booking.booking_date}T${booking.start_time.length === 5 ? `${booking.start_time}:00` : booking.start_time}`);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const { refunded } = await cancelBookingWithRefund(booking, vendorName);
      toast.success(
        refunded > 0
          ? `Booking cancelled — $${refunded.toFixed(2)} credited to your wallet.`
          : "Booking cancelled.",
      );
      setCancelOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (newDate: string, newStart: string, message: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await proposeReschedule({
        booking,
        proposerId: user.id,
        proposerRole: "customer",
        newDate,
        newStart,
        message,
        proposerName: "Your customer",
      });
      toast.success("Reschedule request sent — waiting for the provider to approve.");
      setRescheduleOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reschedule request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!pendingRequest || !user) return;
    setSubmitting(true);
    try {
      await approveReschedule({
        requestId: pendingRequest.id,
        bookingId: booking.id,
        proposerId: pendingRequest.proposer_id,
        recipientId: user.id,
        proposedDate: pendingRequest.proposed_date,
        proposedStart: pendingRequest.proposed_start_time,
        proposedEnd: pendingRequest.proposed_end_time,
        previousStatus: pendingRequest.previous_booking_status,
        responderRole: "customer",
        responderName: "The customer",
      });
      toast.success("Reschedule approved — booking updated.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!pendingRequest || !user) return;
    setSubmitting(true);
    try {
      await declineReschedule({
        requestId: pendingRequest.id,
        bookingId: booking.id,
        proposerId: pendingRequest.proposer_id,
        recipientId: user.id,
        proposedDate: pendingRequest.proposed_date,
        proposedStart: pendingRequest.proposed_start_time,
        proposedEnd: pendingRequest.proposed_end_time,
        previousStatus: pendingRequest.previous_booking_status,
        responderRole: "customer",
        responderName: "The customer",
      });
      toast.success("Reschedule declined — original time kept.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decline");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!pendingRequest) return;
    setSubmitting(true);
    try {
      await cancelRescheduleRequest({
        requestId: pendingRequest.id,
        bookingId: booking.id,
        recipientId: pendingRequest.recipient_id,
        previousStatus: pendingRequest.previous_booking_status,
      });
      toast.success("Request withdrawn.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not withdraw");
    } finally {
      setSubmitting(false);
    }
  };

  const openChat = async () => {
    if (!user) return;
    const { openBookingThread } = await import("@/lib/bookingChat");
    const convId = await openBookingThread(user.id, booking.vendor_id, booking.id);
    if (convId) navigate(`/chat/${convId}`);
    else toast.error("Could not open conversation");
  };

  return (
    <DashboardLayout title="Booking details" subtitle={`#${booking.id.slice(0, 8)}`}>
      <Button variant="ghost" size="sm" onClick={() => navigate("/my-bookings")} className="mb-4 gap-1.5 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to bookings
      </Button>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hero card */}
          <div className="bg-card border border-border rounded-sm p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {vendorAvatar ? (
                <img src={vendorAvatar} alt={vendorName} className="w-14 h-14 rounded-sm object-cover ring-1 ring-border/40 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-sm bg-primary/10 flex items-center justify-center text-fs-base font-bold text-primary shrink-0">
                  {(vendorName || "P").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-fs-base font-semibold text-heading flex items-center gap-1.5">
                  {serviceTitle}
                </p>
                <p className="text-description-sm">
                  with{" "}
                  <Link to={`/provider/${booking.vendor_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    {vendorName} <BadgeCheck className="w-3.5 h-3.5" />
                  </Link>
                </p>
                {vendorAddress && (
                  <p className="text-fs-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {vendorAddress}
                  </p>
                )}
              </div>
              <span className={cn("inline-flex items-center gap-1 text-fs-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", STATUS_STYLE[booking.status])}>
                {booking.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/40">
              <Stat label="Date" value={format(startDate, "MMM d, yyyy")} icon={CalendarCheck} />
              <Stat label="Time" value={`${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`} icon={Clock} />
              <Stat label="Countdown" value={policy.isPast ? "Started" : formatTimeUntil(policy.hoursUntilStart)} icon={CalendarClock} />
              <Stat label="Total" value={booking.total_price != null ? `$${Number(booking.total_price).toFixed(2)}` : "TBD"} icon={Receipt} />
            </div>
          </div>

          {/* Pending reschedule request */}
          {pendingRequest && (
            <RescheduleApprovalCard
              request={pendingRequest}
              isRecipient={pendingRequest.recipient_id === user!.id}
              proposerName={pendingRequest.proposer_role === "provider" ? vendorName : "You"}
              submitting={submitting}
              onApprove={handleApproveRequest}
              onDecline={handleDeclineRequest}
              onWithdraw={pendingRequest.proposer_id === user!.id ? handleWithdrawRequest : undefined}
            />
          )}

          {/* Contract timeline */}
          <BookingTimeline
            status={booking.status}
            createdAt={booking.created_at}
            updatedAt={booking.updated_at}
            bookingDate={booking.booking_date}
            startTime={booking.start_time}
            paidAmount={paid}
          />

          {/* Notes */}
          {booking.notes && (
            <div className="bg-card border border-border rounded-sm p-5">
              <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Notes for the pro
              </p>
              <p className="text-description-sm whitespace-pre-line">{booking.notes}</p>
            </div>
          )}

          {/* Cancellation policy notice */}
          <div className="bg-card border border-border rounded-sm p-5">
            <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Cancellation policy
            </p>
            <ul className="text-fs-sm text-body space-y-1.5">
              <PolicyRow active={policy.refundPercent === 100 && !policy.isPast && policy.canCancel} label="≥ 48 hours before start" tier="100% refund to wallet" />
              <PolicyRow active={policy.refundPercent === 50} label="24–48 hours before start" tier="50% refund to wallet" />
              <PolicyRow active={policy.refundPercent === 0 && paid > 0 && policy.canCancel} label="Less than 24 hours" tier="Non-refundable" warn />
            </ul>
            {paid > 0 && policy.canCancel && (
              <p className="text-fs-xs text-muted-foreground mt-3">
                If you cancel now: <span className="text-heading font-semibold">${policy.refundAmount.toFixed(2)}</span> refunded of ${paid.toFixed(2)} paid.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <aside className="space-y-3">
          <div className="bg-card border border-border rounded-sm p-5 lg:sticky lg:top-20">
            <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Manage booking</p>

            <Button onClick={openChat} className="w-full gap-1.5 mb-2">
              <MessageSquare className="w-4 h-4" /> Message {vendorName.split(" ")[0] || "your pro"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setRescheduleOpen(true)}
              disabled={!policy.canReschedule}
              className="w-full gap-1.5 mb-2"
            >
              <CalendarClock className="w-4 h-4" /> Reschedule
            </Button>
            {!policy.canReschedule && policy.rescheduleBlockedReason && (
              <p className="text-[13px] text-muted-foreground mb-3 px-1 leading-relaxed">{policy.rescheduleBlockedReason}</p>
            )}

            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={!policy.canCancel}
              className="w-full gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <X className="w-4 h-4" /> Cancel booking
            </Button>

            {booking.status === "completed" && (
              <Link to="/my-reviews">
                <Button variant="outline" className="w-full gap-1.5 mt-2">
                  <Star className="w-4 h-4" /> Leave a review
                </Button>
              </Link>
            )}

            {booking.status !== "cancelled" && (
              <DownloadReceiptButton
                bookingId={booking.id}
                variant="outline"
                size="default"
                className="w-full gap-1.5 mt-2"
                label="Download receipt"
              />
            )}
          </div>

          {paid > 0 && (
            <div className="bg-card border border-border rounded-sm p-5">
              <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                <Wallet className="w-3 h-3" /> Payment
              </p>
              <dl className="text-fs-xs space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">${Number(booking.subtotal ?? 0).toFixed(2)}</dd></div>
                {Number(booking.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums text-emerald-600">-${Number(booking.discount_amount).toFixed(2)}</dd></div>
                )}
                {Number(booking.tax_amount ?? 0) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">${Number(booking.tax_amount).toFixed(2)}</dd></div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-border/40 text-fs-sm">
                  <dt className="font-semibold text-heading">Paid</dt>
                  <dd className="tabular-nums font-semibold text-heading">${paid.toFixed(2)}</dd>
                </div>
                <p className="text-[10px] text-muted-foreground capitalize pt-1">
                  {booking.payment_status.replace("_", " ")}
                </p>
              </dl>
            </div>
          )}

          {Number(booking.total_price ?? 0) > 0 && (
            <CommissionBreakdown total={Number(booking.total_price)} audience="client" />
          )}
        </aside>
      </div>

      <CancelBookingModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        bookingDate={booking.booking_date}
        startTime={booking.start_time}
        status={booking.status}
        paidAmount={paid}
        vendorName={vendorName}
        serviceTitle={serviceTitle}
        submitting={submitting}
        onConfirm={handleCancel}
        onFileDispute={() => { setCancelOpen(false); setDisputeOpen(true); }}
      />

      <ReportIssueModal
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        bookingId={booking.id}
        reportedUserId={booking.vendor_id}
        prefill={{
          type: "service_quality",
          subject: `Cancellation issue — ${serviceTitle || "booking"} on ${booking.booking_date}`,
          description: `I tried to cancel my booking with ${vendorName || "my pro"} (${serviceTitle || "service"}) scheduled for ${booking.booking_date} at ${booking.start_time?.slice(0, 5)}, but the standard cancellation window has closed (less than 24h before start) and no automatic refund is available.\n\nReason for the dispute:\n• \n\nBooking ID: ${booking.id}\nAmount paid: $${paid.toFixed(2)}`,
        }}
      />

      <ProposeRescheduleModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        bookingDate={booking.booking_date}
        startTime={booking.start_time}
        status={booking.status}
        customerName={vendorName}
        serviceTitle={serviceTitle}
        submitting={submitting}
        onConfirm={handleReschedule}
      />
    </DashboardLayout>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-fs-sm font-medium text-heading">{value}</p>
    </div>
  );
}

function PolicyRow({ label, tier, active, warn }: { label: string; tier: string; active?: boolean; warn?: boolean }) {
  return (
    <li className={cn(
      "flex items-center justify-between rounded-sm px-2.5 py-1.5 text-fs-xs",
      active ? (warn ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary") : "text-muted-foreground",
    )}>
      <span>{label}</span>
      <span className="font-medium">{tier}</span>
    </li>
  );
}
