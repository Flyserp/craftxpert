import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, CalendarCheck, CreditCard, AlertCircle, Info, MessageSquare, Star, Megaphone, Navigation, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeaderIconButton from "@/components/header/HeaderIconButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import LeaveReviewModal from "@/components/reviews/LeaveReviewModal";
import ProviderReplyInline from "@/components/reviews/ProviderReplyInline";
import { usePermission } from "@/hooks/usePermission";
import { Heading } from "@/components/ui/app";

type RoleFlags = { isAdmin: boolean; isProvider: boolean; isStaff: boolean; isClient: boolean };

function getNotificationLink(n: Notification, roles: RoleFlags): string | null {
  const event = (n.metadata?.event as string | undefined) ?? n.type;
  const bookingId = n.metadata?.booking_id as string | undefined;
  const conversationId = n.metadata?.conversation_id as string | undefined;
  const taskId = n.metadata?.task_id as string | undefined;
  const disputeId = n.metadata?.dispute_id as string | undefined;
  const withdrawalId = n.metadata?.withdrawal_id as string | undefined;
  const refundId = n.metadata?.refund_id as string | undefined;
  const verificationId = n.metadata?.verification_id as string | undefined;
  const explicit = (n.metadata?.link as string | undefined) ?? (n.metadata?.url as string | undefined);

  if (explicit) return explicit;

  if (event === "staff_assigned" || event === "staff_unassigned") {
    return bookingId ? `/staff-dashboard?booking=${bookingId}` : "/staff-dashboard";
  }

  if (event === "new_message" || n.type === "new_message") {
    return conversationId ? `/chat?c=${conversationId}` : "/chat";
  }

  if (n.type === "review_received") {
    if (roles.isProvider) return "/provider/reviews";
    return bookingId ? `/client/bookings/${bookingId}` : "/client/reviews";
  }
  if (n.type === "review_reminder") {
    return bookingId ? `/client/bookings/${bookingId}` : "/client/bookings";
  }

  if (n.type.startsWith("booking_") || event === "provider_on_the_way") {
    if (bookingId) {
      if (roles.isProvider) return `/provider/bookings?booking=${bookingId}`;
      if (roles.isClient) return `/client/bookings/${bookingId}`;
    }
    if (roles.isProvider) return "/provider/bookings";
    if (roles.isClient) return "/client/bookings";
    return "/notifications";
  }

  if (n.type === "task_posted" || event === "task_posted") {
    if (roles.isProvider) return taskId ? `/provider/tasks?task=${taskId}` : "/provider/tasks";
    return taskId ? `/client/tasks/${taskId}` : "/browse-tasks";
  }
  if (event === "proposal_received" || event === "proposal_accepted" || event === "proposal_rejected") {
    if (roles.isClient && taskId) return `/client/tasks/${taskId}`;
    if (roles.isProvider) return "/provider/enquiries";
  }

  if (n.type === "payment_success" || n.type === "payment_received") {
    if (roles.isProvider) return "/provider/earnings";
    if (roles.isClient) return "/client/payments";
    if (roles.isAdmin) return "/admin/payments";
  }

  if (event?.startsWith("withdrawal")) {
    if (roles.isAdmin) return withdrawalId ? `/admin/withdrawals?id=${withdrawalId}` : "/admin/withdrawals";
    if (roles.isProvider) return "/provider/withdrawals";
  }

  if (event?.startsWith("refund")) {
    if (roles.isAdmin) return refundId ? `/admin/refunds?id=${refundId}` : "/admin/refunds";
    if (roles.isClient) return "/client/refunds";
  }

  if (event?.startsWith("dispute")) {
    if (roles.isAdmin) return disputeId ? `/admin/disputes?id=${disputeId}` : "/admin/disputes";
    if (roles.isClient) return "/client/disputes";
  }

  if (event?.startsWith("verification") || n.type === "verification_update") {
    if (roles.isAdmin) return verificationId ? `/admin/verifications?id=${verificationId}` : "/admin/verifications";
    if (roles.isProvider) return "/provider/verification";
  }

  return "/notifications";
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  booking_created: { icon: CalendarCheck, color: "text-blue-500" },
  booking_accepted: { icon: Check, color: "text-primary" },
  booking_rejected: { icon: AlertCircle, color: "text-destructive" },
  booking_completed: { icon: CheckCheck, color: "text-primary" },
  booking_cancelled: { icon: AlertCircle, color: "text-destructive" },
  booking_in_progress: { icon: Zap, color: "text-amber-500" },
  provider_on_the_way: { icon: Navigation, color: "text-blue-500" },
  payment_received: { icon: CreditCard, color: "text-primary" },
  payment_success: { icon: CreditCard, color: "text-primary" },
  new_message: { icon: MessageSquare, color: "text-blue-500" },
  review_reminder: { icon: Star, color: "text-amber-500" },
  review_received: { icon: Star, color: "text-amber-500" },
  promotion: { icon: Megaphone, color: "text-primary" },
  status_update: { icon: Info, color: "text-blue-500" },
  info: { icon: Info, color: "text-muted-foreground" },
  task_posted: { icon: CalendarCheck, color: "text-primary" },
};

function NotificationItem({
  notification,
  onRead,
  onLeaveReview,
  reviewedBookingIds,
  onNavigate,
  roles,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onLeaveReview?: (n: Notification) => void;
  reviewedBookingIds?: Set<string>;
  onNavigate?: (path: string) => void;
  roles: RoleFlags;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;
  const bookingId = notification.metadata?.booking_id as string | undefined;
  const isReviewReminder = notification.type === "review_reminder" && bookingId && !reviewedBookingIds?.has(bookingId);
  const isReviewReceived = notification.type === "review_received" && bookingId;
  const link = getNotificationLink(notification, roles);

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id);
    if (link && onNavigate) onNavigate(link);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/40 last:border-0 transition-colors hover:bg-muted/50 cursor-pointer",
        !notification.is_read && "bg-primary/[0.03]"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("mt-0.5 shrink-0", config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-fs-sm leading-snug", !notification.is_read ? "font-semibold text-heading" : "text-body")}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-fs-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
            {isReviewReminder && onLeaveReview && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[13px] px-2 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onLeaveReview(notification);
                }}
              >
                <Star className="w-3 h-3" />
                Leave Review
              </Button>
            )}
          </div>
          {isReviewReceived && (
            <ProviderReplyInline bookingId={bookingId} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { user, hasRole } = useAuth();
  const { isStaff } = usePermission();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; providerId: string } | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());

  const roleFlags: RoleFlags = {
    isAdmin: hasRole("admin"),
    isProvider: hasRole("provider"),
    isStaff,
    isClient: hasRole("customer"),
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const fetchReviewedBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("booking_id")
      .eq("customer_id", user.id);
    if (data) setReviewedBookingIds(new Set(data.map((r) => r.booking_id)));
  }, [user]);

  useEffect(() => {
    fetchReviewedBookings();
  }, [fetchReviewedBookings]);

  const handleLeaveReview = (n: Notification) => {
    setReviewTarget({
      bookingId: n.metadata?.booking_id as string,
      providerId: n.metadata?.vendor_id as string,
    });
    markAsRead(n.id);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <HeaderIconButton aria-label="Notifications" data-testid="notification-bell">
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span
                data-testid="notification-badge"
                data-unread-count={unreadCount}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </HeaderIconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <Heading level={3} >Notifications</Heading>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-fs-xs text-muted-foreground hover:text-heading"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-fs-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : unreadCount === 0 ? (
              <>
                <div className="flex flex-col items-center py-8 text-center px-4 border-b border-border/40">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <CheckCheck className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-fs-sm font-semibold text-heading">You're all caught up</p>
                  <p className="text-fs-xs text-muted-foreground mt-0.5">No unread notifications</p>
                </div>
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={markAsRead} onLeaveReview={handleLeaveReview} reviewedBookingIds={reviewedBookingIds} onNavigate={handleNavigate} roles={roleFlags} />
                ))}
              </>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markAsRead} onLeaveReview={handleLeaveReview} reviewedBookingIds={reviewedBookingIds} onNavigate={handleNavigate} roles={roleFlags} />
              ))
            )}
          </ScrollArea>
          {notifications.length > 0 && (
            <div className="border-t border-border/50 p-2">
              <Link to="/notifications" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full text-fs-xs text-muted-foreground">
                  View all notifications
                </Button>
              </Link>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {reviewTarget && (
        <LeaveReviewModal
          open={!!reviewTarget}
          onOpenChange={(v) => !v && setReviewTarget(null)}
          bookingId={reviewTarget.bookingId}
          providerId={reviewTarget.providerId}
          onReviewSubmitted={fetchReviewedBookings}
        />
      )}
    </>
  );
}
