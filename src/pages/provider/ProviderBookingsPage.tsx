import { useEffect, useState } from"react";
import { Star } from"lucide-react";
import { useNavigate } from"react-router-dom";
import DashboardLayout from"@/components/DashboardLayout";
import { openBookingThread } from"@/lib/bookingChat";
import { cn } from"@/lib/utils";
import { supabase } from"@/integrations/supabase/client";
import { notifyBookingTransition, notifyReviewReminder, createNotification } from"@/lib/notifications";
import { useAuth } from"@/contexts/AuthContext";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { toast } from"sonner";
import { format } from"date-fns";
import {
 Search, CheckCircle2, XCircle, Clock, PlayCircle, CalendarCheck,
 MoreHorizontal, User, MapPin, MessageSquare, Send, Loader2, CalendarClock,
} from"lucide-react";
import ProposeRescheduleModal from"@/components/booking/ProposeRescheduleModal";
import RescheduleApprovalCard from"@/components/booking/RescheduleApprovalCard";
import CommissionBreakdown from"@/components/booking/CommissionBreakdown";
import BookingTimeline from "@/components/booking/BookingTimeline";
import DownloadReceiptButton from"@/components/booking/DownloadReceiptButton";
import {
 proposeReschedule, approveReschedule, declineReschedule,
 cancelRescheduleRequest, getPendingRescheduleRequest,
} from"@/lib/rescheduleRequests";
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from"@/components/ui/dropdown-menu";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from"@/components/ui/select";
import {
 Dialog, DialogContent, DialogHeader, DialogTitle,
} from"@/components/ui/dialog";
import AssignStaffSelect from"@/components/provider/AssignStaffSelect";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

interface Booking {
 id: string;
 customer_id: string;
 service_id: string;
 booking_date: string;
 start_time: string;
 end_time: string;
 total_price: number | null;
 status: string;
 notes: string | null;
 created_at: string;
 updated_at: string;
 assigned_staff_id: string | null;
 customer_name?: string;
 service_title?: string;
}

const statusStyles: Record<string, { bg: string; icon: typeof Clock }> = {
 pending: { bg:"bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", icon: Clock },
 accepted: { bg:"bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", icon: CheckCircle2 },
 confirmed: { bg:"bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", icon: CheckCircle2 },
 reschedule_requested: { bg:"bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", icon: CalendarClock },
 in_progress: { bg:"bg-primary/10 text-primary", icon: PlayCircle },
 completed: { bg:"bg-secondary text-secondary-foreground", icon: CheckCircle2 },
 cancelled: { bg:"bg-destructive/10 text-destructive", icon: XCircle },
};

export default function ProviderBookingsPage() {
 const { user } = useAuth();
 const navigate = useNavigate();

 const openBookingChat = async (b: Booking) => {
 if (!user) return;
 const convoId = await openBookingThread(user.id, b.customer_id, b.id);
 if (convoId) navigate(`/chat/${convoId}`);
 else toast.error("Could not open conversation");
 };
 const [bookings, setBookings] = useState<Booking[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [selected, setSelected] = useState<Booking | null>(null);
 const [replyText, setReplyText] = useState("");
 const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
 const [submittingReply, setSubmittingReply] = useState(false);
 const [reviewForBooking, setReviewForBooking] = useState<any>(null);
 const [proposeFor, setProposeFor] = useState<Booking | null>(null);
 const [submittingReschedule, setSubmittingReschedule] = useState(false);
 const [pendingRequest, setPendingRequest] = useState<any>(null);
 const [loadingRequest, setLoadingRequest] = useState(false);

 useEffect(() => {
 if (user) fetchBookings();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [user]);

 const fetchBookings = async () => {
 let q = supabase
 .from("bookings")
 .select("*, service:vendor_services(title)")
 .order("created_at", { ascending: false });
 q = q.eq("vendor_id", user!.id);
 const { data } = await q;

 if (!data) {
 setLoading(false);
 return;
 }

 const customerIds = [...new Set(data.map((b) => b.customer_id))];
 const { data: profiles } = await supabase
 .from("profiles")
 .select("user_id, display_name")
 .in("user_id", customerIds);

 const nameMap: Record<string, string> = {};
 (profiles || []).forEach((p) => { nameMap[p.user_id] = p.display_name ||"Customer"; });

 setBookings(
 data.map((b) => ({
 ...b,
 customer_name: nameMap[b.customer_id] ||"Customer",
 service_title: (b.service as any)?.title ||"Service",
 }))
 );
 setLoading(false);
 };

 const updateStatus = async (bookingId: string, status: string) => {
 const booking = bookings.find((b) => b.id === bookingId);
 const { error } = await supabase
 .from("bookings")
 .update({ status })
 .eq("id", bookingId);

 if (error) {
 toast.error("Failed to update booking");
 return;
 }

 toast.success(`Booking ${status.replace("_","")}`);
 setBookings((prev) =>
 prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
 );

 if (!booking || !user) return;

 // Map booking status → unified transition (notifies BOTH parties; the
 // tenant policy decides whether the actor is filtered out).
 const transitionMap: Record<string, Parameters<typeof notifyBookingTransition>[0] | undefined> = {
 accepted:"accepted",
 in_progress:"in_progress",
 completed:"completed",
 cancelled:"cancelled",
 };
 const transition = transitionMap[status];
 if (transition) {
 await notifyBookingTransition(transition, {
 bookingId,
 customerId: booking.customer_id,
 vendorId: user.id,
 actorId: user.id,
 providerName:"Your provider",
 bookingDate: booking.booking_date,
 serviceName: booking.service_title,
 });
 // Review reminder after completion (customer only — not a transition).
 if (status ==="completed") {
 await notifyReviewReminder(booking.customer_id, booking.service_title ||"your service", bookingId);
 }
 } else {
 await createNotification({
 userId: booking.customer_id,
 type:"status_update",
 title:"Booking Updated",
 message:`Your booking status has been updated to ${status}.`,
 metadata: { booking_id: bookingId },
 actorId: user.id,
 });
 }
 };

 // Load any pending reschedule request when a booking is opened.
 useEffect(() => {
 if (!selected) { setPendingRequest(null); return; }
 setLoadingRequest(true);
 getPendingRescheduleRequest(selected.id).then((req) => {
 setPendingRequest(req);
 setLoadingRequest(false);
 });
 }, [selected]);

 const handlePropose = async (newDate: string, newStart: string, message: string) => {
 if (!proposeFor || !user) return;
 setSubmittingReschedule(true);
 try {
 await proposeReschedule({
 booking: {
 id: proposeFor.id,
 customer_id: proposeFor.customer_id,
 vendor_id: user.id,
 booking_date: proposeFor.booking_date,
 start_time: proposeFor.start_time,
 status: proposeFor.status,
 },
 proposerId: user.id,
 proposerRole:"provider",
 newDate,
 newStart,
 message,
 proposerName:"Your pro",
 });
 toast.success("Reschedule proposed — waiting for the customer to approve.");
 setBookings((prev) => prev.map((b) =>
 b.id === proposeFor.id ? { ...b, status:"reschedule_requested" } : b,
 ));
 setProposeFor(null);
 } catch (e) {
 toast.error(e instanceof Error ? e.message :"Could not propose reschedule");
 } finally {
 setSubmittingReschedule(false);
 }
 };

 const handleApproveReq = async () => {
 if (!pendingRequest || !selected || !user) return;
 setSubmittingReschedule(true);
 try {
 await approveReschedule({
 requestId: pendingRequest.id,
 bookingId: selected.id,
 proposerId: pendingRequest.proposer_id,
 recipientId: user.id,
 proposedDate: pendingRequest.proposed_date,
 proposedStart: pendingRequest.proposed_start_time,
 proposedEnd: pendingRequest.proposed_end_time,
 previousStatus: pendingRequest.previous_booking_status,
 responderRole:"provider",
 responderName:"Your pro",
 });
 toast.success("Reschedule approved.");
 await fetchBookings();
 setPendingRequest(null);
 setSelected(null);
 } catch (e) {
 toast.error(e instanceof Error ? e.message :"Could not approve");
 } finally {
 setSubmittingReschedule(false);
 }
 };

 const handleDeclineReq = async () => {
 if (!pendingRequest || !selected || !user) return;
 setSubmittingReschedule(true);
 try {
 await declineReschedule({
 requestId: pendingRequest.id,
 bookingId: selected.id,
 proposerId: pendingRequest.proposer_id,
 recipientId: user.id,
 proposedDate: pendingRequest.proposed_date,
 proposedStart: pendingRequest.proposed_start_time,
 proposedEnd: pendingRequest.proposed_end_time,
 previousStatus: pendingRequest.previous_booking_status,
 responderRole:"provider",
 responderName:"Your pro",
 });
 toast.success("Reschedule declined.");
 await fetchBookings();
 setPendingRequest(null);
 setSelected(null);
 } catch (e) {
 toast.error(e instanceof Error ? e.message :"Could not decline");
 } finally {
 setSubmittingReschedule(false);
 }
 };

 const handleWithdrawReq = async () => {
 if (!pendingRequest || !selected) return;
 setSubmittingReschedule(true);
 try {
 await cancelRescheduleRequest({
 requestId: pendingRequest.id,
 bookingId: selected.id,
 recipientId: pendingRequest.recipient_id,
 previousStatus: pendingRequest.previous_booking_status,
 });
 toast.success("Reschedule request withdrawn.");
 await fetchBookings();
 setPendingRequest(null);
 setSelected(null);
 } catch (e) {
 toast.error(e instanceof Error ? e.message :"Could not withdraw");
 } finally {
 setSubmittingReschedule(false);
 }
 };

 const filtered = bookings.filter((b) => {
 if (statusFilter !=="all" && b.status !== statusFilter) return false;
 if (search) {
 const q = search.toLowerCase();
 return (
 (b.customer_name ||"").toLowerCase().includes(q) ||
 (b.service_title ||"").toLowerCase().includes(q)
 );
 }
 return true;
 });

 const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

 const counts = {
 all: bookings.length,
 pending: bookings.filter((b) => b.status ==="pending").length,
 accepted: bookings.filter((b) => b.status ==="accepted").length,
 in_progress: bookings.filter((b) => b.status ==="in_progress").length,
 completed: bookings.filter((b) => b.status ==="completed").length,
 };

 return (
 <DashboardLayout title="My Bookings" subtitle="Manage incoming bookings and update job status.">
 {loading ? (
 <LoadingState variant="section" />
 ) : (
 <div className="space-y-6">
 {/* Status tabs */}
 <div className="flex flex-wrap gap-2 animate-reveal">
 {(["all","pending","accepted","in_progress","completed"] as const).map((s) => (
 <button
 key={s}
 onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-sm text-fs-xs font-medium transition-all active:scale-95 ${
 statusFilter === s
 ?"bg-primary text-primary-foreground"
 :"bg-muted text-muted-foreground hover:bg-muted/80"
 }`}
 >
 {s ==="all" ?"All" : s.replace("_","")} ({counts[s] || 0})
 </button>
 ))}
 </div>

 {/* Search */}
 <div className="relative max-w-sm animate-reveal" style={{ animationDelay:"60ms" }}>
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search bookings…"
 className="pl-9"
 />
 </div>

 {/* Booking cards */}
 {filtered.length === 0 ? (
 <div className="flex flex-col items-center py-16 text-center">
 <CalendarCheck className="w-12 h-12 text-muted-foreground mb-4" />
 <p className="text-description-sm">
 {bookings.length === 0 ?"No bookings yet." :"No bookings match your filter."}
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {pageItems.map((b, i) => {
 const style = statusStyles[b.status] || statusStyles.pending;
 const StatusIcon = style.icon;
 return (
 <div
 key={b.id}
 className="bg-card rounded-sm border border-border p-5 animate-reveal"
 style={{ animationDelay:`${i * 40}ms` }}
 >
 <div className="flex items-start justify-between gap-4">
 <button
 onClick={() => setSelected(b)}
 className="flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
 >
 <div className="flex items-center gap-3 mb-2">
 <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-fs-xs font-bold text-primary shrink-0">
 {(b.customer_name ||"C")[0].toUpperCase()}
 </div>
 <div className="min-w-0">
 <p className="text-fs-sm font-semibold text-heading truncate">
 {b.service_title}
 </p>
 <p className="text-fs-xs text-muted-foreground">
 {b.customer_name} • {format(new Date(b.booking_date),"MMM d, yyyy")} • {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}
 </p>
 </div>
 </div>
 </button>

 <div className="flex items-center gap-2 shrink-0">
 <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${style.bg}`}>
 <StatusIcon className="w-3 h-3" />
 {b.status.replace("_","")}
 </span>
 {b.total_price && (
 <span className="text-fs-sm font-semibold text-heading tabular-nums">
 ${b.total_price}
 </span>
 )}

 {b.status !=="cancelled" && (
 <DownloadReceiptButton bookingId={b.id} iconOnly className="h-10 w-10 p-0" />
 )}

 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="w-10 p-0">
 <MoreHorizontal className="w-4 h-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => openBookingChat(b)}>
 <MessageSquare className="w-4 h-4 mr-2" /> Message customer
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 {b.status ==="pending" && (
 <>
 <DropdownMenuItem onClick={() => updateStatus(b.id,"accepted")}>
 <CheckCircle2 className="w-4 h-4 mr-2" /> Accept
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => updateStatus(b.id,"cancelled")}
 className="text-destructive"
 >
 <XCircle className="w-4 h-4 mr-2" /> Reject
 </DropdownMenuItem>
 </>
 )}
 {b.status ==="accepted" && (
 <DropdownMenuItem onClick={() => updateStatus(b.id,"in_progress")}>
 <PlayCircle className="w-4 h-4 mr-2" /> Start Job
 </DropdownMenuItem>
 )}
 {b.status ==="in_progress" && (
 <DropdownMenuItem onClick={() => updateStatus(b.id,"completed")}>
 <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Completed
 </DropdownMenuItem>
 )}
 {["pending","accepted","confirmed"].includes(b.status) && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => setProposeFor(b)}>
 <CalendarClock className="w-4 h-4 mr-2" /> Propose reschedule
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => updateStatus(b.id,"cancelled")}
 className="text-destructive"
 >
 <XCircle className="w-4 h-4 mr-2" /> Cancel
 </DropdownMenuItem>
 </>
 )}
 {b.status ==="reschedule_requested" && (
 <DropdownMenuItem onClick={() => setSelected(b)}>
 <CalendarClock className="w-4 h-4 mr-2" /> Review request
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>
 {b.notes && (
 <p className="text-fs-xs text-muted-foreground mt-2 pl-12 line-clamp-2">
 Note: {b.notes}
 </p>
 )}
 </div>
 );
 })}
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

 {/* Booking detail modal */}
 <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Booking Details</DialogTitle>
 </DialogHeader>
 {selected && (
 <div className="space-y-4 pt-2">
 <div>
 <Heading level={3} >{selected.service_title}</Heading>
 <span className={`inline-flex items-center gap-1 text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 ${statusStyles[selected.status]?.bg ||""}`}>
 {selected.status.replace("_","")}
 </span>
 </div>

 <div className="grid grid-cols-2 gap-4 text-fs-sm">
 <div>
 <p className="text-fs-xs text-muted-foreground mb-0.5">Customer</p>
 <p className="font-medium text-heading flex items-center gap-1.5">
 <User className="w-3.5 h-3.5" /> {selected.customer_name}
 </p>
 </div>
 <div>
 <p className="text-fs-xs text-muted-foreground mb-0.5">Date</p>
 <p className="font-medium text-heading">
 {format(new Date(selected.booking_date),"MMMM d, yyyy")}
 </p>
 </div>
 <div>
 <p className="text-fs-xs text-muted-foreground mb-0.5">Time</p>
 <p className="font-medium text-heading tabular-nums">
 {selected.start_time?.slice(0, 5)} – {selected.end_time?.slice(0, 5)}
 </p>
 </div>
 <div>
 <p className="text-fs-xs text-muted-foreground mb-0.5">Price</p>
 <p className="font-medium text-heading tabular-nums">
 {selected.total_price ?`$${selected.total_price}` :"—"}
 </p>
 </div>
 </div>

 {selected.notes && (
 <div>
 <p className="text-fs-xs text-muted-foreground mb-1">Notes</p>
 <p className="text-description-sm">{selected.notes}</p>
 </div>
 )}

 {Number(selected.total_price ?? 0) > 0 && (
 <CommissionBreakdown total={Number(selected.total_price)} audience="provider" />
 )}

 <BookingTimeline
  status={selected.status}
  createdAt={selected.created_at}
  updatedAt={selected.updated_at}
  bookingDate={selected.booking_date}
  startTime={selected.start_time}
  paidAmount={Number(selected.total_price ?? 0)}
 />

 {/* Review & Reply Section */}
 {selected.status ==="completed" && (
 <ReviewReplySection
 bookingId={selected.id}
 providerId={user!.id}
 />
 )}

 {/* Pending reschedule request */}
 {pendingRequest && !loadingRequest && (
 <RescheduleApprovalCard
 request={pendingRequest}
 isRecipient={pendingRequest.recipient_id === user!.id}
 proposerName={pendingRequest.proposer_role ==="provider" ?"You" : selected.customer_name}
 submitting={submittingReschedule}
 onApprove={handleApproveReq}
 onDecline={handleDeclineReq}
 onWithdraw={pendingRequest.proposer_id === user!.id ? handleWithdrawReq : undefined}
 />
 )}

 {/* Staff assignment */}
 <AssignStaffSelect
 bookingId={selected.id}
 currentStaffId={selected.assigned_staff_id}
 onAssigned={(staffId) => {
 setSelected({ ...selected, assigned_staff_id: staffId });
 setBookings((prev) =>
 prev.map((b) =>
 b.id === selected.id ? { ...b, assigned_staff_id: staffId } : b
 )
 );
 }}
 />

 <div className="flex gap-2 pt-2 flex-wrap">
 {selected.status ==="pending" && (
 <>
 <Button size="sm" onClick={() => { updateStatus(selected.id,"accepted"); setSelected(null); }} className="gap-1.5">
 <CheckCircle2 className="w-4 h-4" /> Accept
 </Button>
 <Button size="sm" variant="destructive" onClick={() => { updateStatus(selected.id,"cancelled"); setSelected(null); }} className="gap-1.5">
 <XCircle className="w-4 h-4" /> Reject
 </Button>
 </>
 )}
 {selected.status ==="accepted" && (
 <Button size="sm" onClick={() => { updateStatus(selected.id,"in_progress"); setSelected(null); }} className="gap-1.5">
 <PlayCircle className="w-4 h-4" /> Start Job
 </Button>
 )}
 {selected.status ==="in_progress" && (
 <Button size="sm" onClick={() => { updateStatus(selected.id,"completed"); setSelected(null); }} className="gap-1.5">
 <CheckCircle2 className="w-4 h-4" /> Mark Completed
 </Button>
 )}
 {["pending","accepted","confirmed"].includes(selected.status) && !pendingRequest && (
 <Button size="sm" variant="outline" onClick={() => { setProposeFor(selected); setSelected(null); }} className="gap-1.5">
 <CalendarClock className="w-4 h-4" /> Propose reschedule
 </Button>
 )}
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* Propose reschedule modal */}
 {proposeFor && (
 <ProposeRescheduleModal
 open={!!proposeFor}
 onOpenChange={(v) => !v && setProposeFor(null)}
 bookingDate={proposeFor.booking_date}
 startTime={proposeFor.start_time}
 status={proposeFor.status}
 customerName={proposeFor.customer_name}
 serviceTitle={proposeFor.service_title}
 submitting={submittingReschedule}
 onConfirm={handlePropose}
 />
 )}
 </div>
 )}
 </DashboardLayout>
 );
}

/* ─── Review Reply Sub-Component ─── */
function ReviewReplySection({ bookingId, providerId }: { bookingId: string; providerId: string }) {
 const [review, setReview] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [replyText, setReplyText] = useState("");
 const [submitting, setSubmitting] = useState(false);

 useEffect(() => {
 supabase
 .from("reviews")
 .select("id, rating, comment, vendor_reply, vendor_reply_at, before_photos, after_photos")
 .eq("booking_id", bookingId)
 .single()
 .then(({ data }) => {
 setReview(data);
 setLoading(false);
 });
 }, [bookingId]);

 if (loading) return null;
 if (!review) return (
 <div className="bg-muted/50 rounded-lg p-3">
 <p className="text-fs-xs text-muted-foreground">No review submitted yet</p>
 </div>
 );

 const handleReply = async () => {
 if (!replyText.trim()) return;
 setSubmitting(true);
 const { error } = await supabase
 .from("reviews")
 .update({ vendor_reply: replyText.trim(), vendor_reply_at: new Date().toISOString() })
 .eq("id", review.id);

 if (error) {
 toast.error("Failed to submit reply");
 } else {
 toast.success("Reply posted");
 setReview({ ...review, vendor_reply: replyText.trim(), vendor_reply_at: new Date().toISOString() });
 }
 setSubmitting(false);
 };

 return (
 <div className="bg-muted/30 rounded-sm p-4 space-y-3">
 <div className="flex items-center gap-2">
 <MessageSquare className="w-4 h-4 text-primary" />
 <span className="text-fs-xs font-semibold text-heading">Customer Review</span>
 </div>
 <div className="flex items-center gap-0.5">
 {[1, 2, 3, 4, 5].map((s) => (
 <Star key={s} className={cn("w-3.5 h-3.5", s <= review.rating ?"text-amber-400 fill-amber-400" :"text-border")} />
 ))}
 <span className="text-fs-xs text-muted-foreground ml-1">{review.rating}/5</span>
 </div>
 {review.comment && <p className="text-description-sm">{review.comment}</p>}

 {/* Before/After thumbnails */}
 {((review.before_photos?.length > 0) || (review.after_photos?.length > 0)) && (
 <div className="flex gap-1.5 flex-wrap">
 {(review.before_photos || []).map((url: string, i: number) => (
 <img key={`b${i}`} src={url} alt="Before" className="w-12 h-12 rounded object-cover border border-border/60" />
 ))}
 {(review.after_photos || []).map((url: string, i: number) => (
 <img key={`a${i}`} src={url} alt="After" className="w-12 h-12 rounded object-cover border border-border/60" />
 ))}
 </div>
 )}

 {review.vendor_reply ? (
 <div className="pl-3 border-l-2 border-primary/30">
 <p className="text-[13px] font-semibold text-heading mb-0.5">Your Reply</p>
 <p className="text-fs-xs text-body">{review.vendor_reply}</p>
 </div>
 ) : (
 <div className="flex gap-2">
 <input
 value={replyText}
 onChange={(e) => setReplyText(e.target.value)}
 placeholder="Write a reply..."
 className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-fs-sm"
 />
 <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || submitting} className="gap-1">
 {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
 Reply
 </Button>
 </div>
 )}
 </div>
 );
}
