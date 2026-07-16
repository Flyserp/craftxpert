import { supabase } from "@/integrations/supabase/client";
import { loadTenantPolicy, type RecipientRole } from "@/lib/notificationPolicy";

export type NotificationType =
  | "booking_created"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_completed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_in_progress"
  | "provider_on_the_way"
  | "payment_received"
  | "payment_success"
  | "payment_failed"
  | "payout_sent"
  | "new_message"
  | "review_reminder"
  | "review_received"
  | "promotion"
  | "status_update"
  | "info"
  | "task_posted"
  | "proposal_received"
  | "proposal_accepted"
  | "proposal_declined"
  | "task_assigned"
  | "task_invitation"
  | "proposal_shortlisted"
  | "hire_confirmed"
  | "subscription_renewed"
  | "subscription_expiring"
  | "subscription_expired"
  | "verification_approved"
  | "verification_rejected"
  | "verification_info_requested"
  | "verification_resubmitted"
  | "job_expiring"
  | "job_expired";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  /** Role of the recipient. Used to gate the message via the tenant policy. */
  recipientRole?: RecipientRole;
  /**
   * Optional id of the user who triggered the event. When the tenant policy for
   * the event bucket has `notify_both = false`, a notification whose `userId`
   * equals the `actorId` is silently dropped (the actor doesn't get notified
   * of their own action).
   */
  actorId?: string;
}

/** Look up a user's role to gate against the tenant recipient policy. */
async function resolveRecipientRole(userId: string): Promise<RecipientRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const role = (data?.role ?? null) as RecipientRole | null;
  return role;
}

/** Maps a notification type to a preference event_type bucket. */
function eventTypeFor(type: NotificationType): string {
  if (type.startsWith("booking_") || type.startsWith("proposal_") || type.startsWith("task_") || type === "provider_on_the_way" || type === "status_update") {
    return "bookings";
  }
  if (type === "hire_confirmed" || type === "job_expiring" || type === "job_expired") return "bookings";
  if (type === "new_message") return "messages";
  if (type === "review_reminder" || type === "review_received") return "reviews";
  if (type === "payment_success" || type === "payment_received" || type === "payment_failed" || type === "payout_sent") return "payments";
  if (type.startsWith("subscription_")) return "payments";
  if (type.startsWith("verification_")) return "bookings";
  if (type === "promotion") return "marketing";
  return "bookings";
}

const DEFAULT_PREFS = { in_app_enabled: true, email_enabled: true, sms_enabled: false, push_enabled: true };

async function loadPrefs(userId: string, eventType: string) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled, email_enabled, sms_enabled, push_enabled" as any)
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .maybeSingle();
  return (data as any) ?? DEFAULT_PREFS;
}

/**
 * Fire-and-forget audit log entry recording a notification dispatch attempt.
 * Written to `admin_audit_log` so admins can debug delivery (which channels
 * fired, which were gated, which failed). Failures here are silent — auditing
 * must never break the user flow.
 */
function logNotificationAudit(entry: {
  recipientId: string;
  type: NotificationType;
  eventType: string;
  bookingId?: string | null;
  actorId?: string | null;
  inApp: { attempted: boolean; ok?: boolean; error?: string; skippedReason?: string };
  channels: { email?: "queued" | "skipped" | "blocked"; sms?: "queued" | "skipped" | "blocked" };
  outcome: "delivered" | "skipped" | "partial" | "failed";
  reason?: string;
}) {
  // actor_id requires authenticated context; fall back to recipient if not provided.
  const actor = entry.actorId ?? entry.recipientId;
  supabase
    .from("admin_audit_log")
    .insert({
      actor_id: actor,
      target_user_id: entry.recipientId,
      action: `notification.${entry.outcome}`,
      entity_type: "notification",
      entity_id: entry.bookingId ?? null,
      details: {
        notification_type: entry.type,
        event_type: entry.eventType,
        booking_id: entry.bookingId ?? null,
        in_app: entry.inApp,
        channels: entry.channels,
        reason: entry.reason ?? null,
      } as any,
    } as any)
    .then(({ error }) => {
      if (error) console.warn("notification audit log failed:", error.message);
    });
}

export async function createNotification({ userId, type, title, message, metadata = {}, recipientRole, actorId }: CreateNotificationParams) {
  const eventType = eventTypeFor(type) as keyof Awaited<ReturnType<typeof loadTenantPolicy>>;
  const bookingId = (metadata?.booking_id as string | undefined) ?? null;

  // 1. Tenant-level policy gate (admin-controlled, applies platform-wide).
  const policy = await loadTenantPolicy().catch(() => null);
  const bucket = policy?.[eventType];

  if (bucket) {
    // a) Actor gate: if policy says "other party only" and the recipient IS the
    //    actor, drop the notification silently.
    if (actorId && actorId === userId && bucket.notify_both === false) {
      logNotificationAudit({
        recipientId: userId, type, eventType, bookingId, actorId,
        inApp: { attempted: false, skippedReason: "actor_gate" },
        channels: {},
        outcome: "skipped",
        reason: "actor is recipient and notify_both=false",
      });
      return;
    }

    // b) Recipient-role gate: skip if this role is not configured to receive this event.
    const role = recipientRole ?? (await resolveRecipientRole(userId));
    if (role && bucket.recipients[role] === false) {
      logNotificationAudit({
        recipientId: userId, type, eventType, bookingId, actorId,
        inApp: { attempted: false, skippedReason: "recipient_role_disabled" },
        channels: {},
        outcome: "skipped",
        reason: `recipient role "${role}" disabled in policy`,
      });
      return;
    }
  }

  // 2. Per-user preferences (user can opt out further within what tenant allows).
  const prefs = await loadPrefs(userId, eventType);

  const tenantInApp = bucket ? bucket.channels.in_app !== false : true;
  const tenantEmail = bucket ? bucket.channels.email  !== false : true;
  const tenantSms   = bucket ? bucket.channels.sms    !== false : true;

  const inAppAllowed = tenantInApp && prefs.in_app_enabled !== false;
  let inAppOk: boolean | undefined;
  let inAppError: string | undefined;

  // In-app channel (notification bell + page). Defaults to on.
  if (inAppAllowed) {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      metadata,
    } as any);
    if (error) {
      console.error("Failed to create notification:", error);
      inAppOk = false;
      inAppError = error.message;
    } else {
      inAppOk = true;
    }
  }

  // Email / SMS channels — fire-and-forget via edge function
  const channels: ("email" | "sms")[] = [];
  const channelStatus: { email?: "queued" | "skipped" | "blocked"; sms?: "queued" | "skipped" | "blocked" } = {};
  if (tenantEmail && prefs.email_enabled) {
    channels.push("email");
    channelStatus.email = "queued";
  } else if (!tenantEmail) {
    channelStatus.email = "blocked";
  } else if (!prefs.email_enabled) {
    channelStatus.email = "skipped";
  }
  if (tenantSms && prefs.sms_enabled) {
    channels.push("sms");
    channelStatus.sms = "queued";
  } else if (!tenantSms) {
    channelStatus.sms = "blocked";
  } else if (!prefs.sms_enabled) {
    channelStatus.sms = "skipped";
  }

  if (channels.length > 0) {
    supabase.functions
      .invoke("dispatch-notification-channels", {
        body: { userId, type, eventType, title, message, metadata, channels },
      })
      .catch((err) => console.error("dispatch-notification-channels failed:", err));
  }

  // Determine overall outcome for the audit row.
  const inAppDelivered = inAppAllowed && inAppOk === true;
  const inAppFailed = inAppAllowed && inAppOk === false;
  const channelsQueued = channels.length > 0;

  let outcome: "delivered" | "skipped" | "partial" | "failed";
  if (inAppFailed && !channelsQueued) outcome = "failed";
  else if (inAppDelivered || channelsQueued) outcome = inAppFailed ? "partial" : "delivered";
  else outcome = "skipped";

  logNotificationAudit({
    recipientId: userId, type, eventType, bookingId, actorId,
    inApp: {
      attempted: inAppAllowed,
      ok: inAppOk,
      error: inAppError,
      skippedReason: inAppAllowed ? undefined : (!tenantInApp ? "tenant_blocked" : "user_pref_off"),
    },
    channels: channelStatus,
    outcome,
  });
}

/* ═══════════════════════════════════════════
   Pre-built notification helpers (localized)
   ═══════════════════════════════════════════ */

import { getNotificationCopy } from "@/lib/notificationMessages";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);

/** Builds a notification from the localized template, then dispatches it. */
function dispatchLocalized(
  userId: string,
  type: NotificationType,
  vars: Record<string, string | number | undefined>,
  fallback: { title: string; message: string },
  metadata?: Record<string, any>,
  actorId?: string,
) {
  const copy = getNotificationCopy(type, vars) ?? fallback;
  return createNotification({ userId, type, title: copy.title, message: copy.message, metadata, actorId });
}

export function notifyBookingCreated(customerId: string, providerName: string, bookingDate: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "booking_created",
    { providerName, date: bookingDate },
    { title: "Booking Requested ✨", message: `Your booking with ${providerName} for ${bookingDate} is pending confirmation.` },
    metadata
  );
}

export function notifyBookingAccepted(customerId: string, providerName: string, bookingDate: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "booking_accepted",
    { providerName, date: bookingDate },
    { title: "Booking Accepted ✅", message: `${providerName} has accepted your booking for ${bookingDate}.` },
    metadata
  );
}

export function notifyBookingRejected(customerId: string, providerName: string, bookingDate: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "booking_rejected",
    { providerName, date: bookingDate },
    { title: "Booking Declined", message: `${providerName} can't take your booking on ${bookingDate}.` },
    metadata
  );
}

export function notifyProviderOnTheWay(customerId: string, providerName: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "provider_on_the_way",
    { providerName },
    { title: "Provider On The Way 🚗", message: `${providerName} is on their way to your location.` },
    metadata
  );
}

export function notifyPaymentSuccess(userId: string, amount: number, description: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    userId,
    "payment_success",
    { amount: formatMoney(amount), description },
    { title: "Payment Successful 💳", message: `Your payment of ${formatMoney(amount)} for ${description} was processed.` },
    metadata
  );
}

export function notifyPaymentReceived(vendorId: string, amount: number, description: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    vendorId,
    "payment_received",
    { amount: formatMoney(amount), description },
    { title: "Payment Received 💰", message: `You received ${formatMoney(amount)} for ${description}.` },
    metadata
  );
}

export function notifyPaymentRefunded(customerId: string, amount: number, description: string, metadata?: Record<string, any>) {
  // Refunds reuse the payment_success channel with refund-specific copy.
  return createNotification({
    userId: customerId,
    type: "payment_success",
    title: "Refund Processed 💸",
    message: `A refund of ${formatMoney(amount)} for ${description} has been credited.`,
    metadata,
  });
}

export function notifyNewMessage(userId: string, senderName: string) {
  return createNotification({
    userId,
    type: "new_message",
    title: "New Message 💬",
    message: `You have a new message from ${senderName}.`,
  });
}

export function notifyReviewReminder(customerId: string, serviceName: string, bookingId: string) {
  return createNotification({
    userId: customerId,
    type: "review_reminder",
    title: "How was your experience? ⭐",
    message: `Your "${serviceName}" service is complete! Leave a review to help others.`,
    metadata: { bookingId },
  });
}

export function notifyReviewReceived(providerId: string, rating: number, customerName: string) {
  return createNotification({
    userId: providerId,
    type: "review_received",
    title: "New Review Received ⭐",
    message: `${customerName} left you a ${rating}-star review. Check it out!`,
  });
}

export function notifyPromotion(userId: string, title: string, message: string, metadata?: Record<string, any>) {
  return createNotification({ userId, type: "promotion", title, message, metadata });
}

export function notifyBookingCompleted(customerId: string, serviceName: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "booking_completed",
    { serviceName },
    { title: "Service Completed 🎉", message: `Your "${serviceName}" booking has been marked complete.` },
    metadata
  );
}

export function notifyBookingInProgress(customerId: string, providerName: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    customerId,
    "booking_in_progress",
    { providerName },
    { title: "Service Started 🔧", message: `${providerName} has started working on your service.` },
    metadata
  );
}

export function notifyBookingCancelled(
  userId: string,
  serviceName: string,
  bookingDate: string,
  reason?: string,
  metadata?: Record<string, any>
) {
  const reasonSuffix = reason ? ` Reason: ${reason}` : "";
  return dispatchLocalized(
    userId,
    "booking_cancelled",
    { serviceName, date: bookingDate, reasonSuffix },
    { title: "Booking Cancelled", message: `Your booking for "${serviceName}" on ${bookingDate} has been cancelled.${reasonSuffix}` },
    metadata
  );
}

export function notifyBookingRescheduled(userId: string, newDate: string, newTime: string, metadata?: Record<string, any>) {
  return dispatchLocalized(
    userId,
    "booking_rescheduled",
    { date: newDate, time: newTime },
    { title: "Booking Rescheduled 🔄", message: `Your booking has been moved to ${newDate} at ${newTime}.` },
    metadata
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Unified booking transition dispatcher
   Sends the appropriate localized notification to BOTH parties for any
   booking status change. The tenant policy's `notify_both` flag (set per
   bucket in /admin/notification-policy) decides whether the actor also
   receives the notification or only the other party does.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BookingTransition =
  | "created"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rescheduled";

interface TransitionContext {
  bookingId: string;
  customerId: string;
  vendorId: string;
  /** The user who triggered this transition (provider, customer, or staff). */
  actorId: string;
  /** Best-effort labels used in the localized copy. */
  serviceName?: string;
  providerName?: string;
  bookingDate?: string;
  newDate?: string;
  newTime?: string;
  reason?: string;
}

/**
 * Fire-and-forget email send via the existing `send-booking-email` edge function.
 * The function looks up the saved email_templates row by key, substitutes the
 * variables, and logs the send to admin_audit_log. We don't await it so the
 * UI flow stays snappy — failures are logged to console.
 */
function sendBookingEmail(
  templateKey: string,
  recipientUserId: string,
  variables: Record<string, string | number | undefined>,
) {
  // Strip undefined values; the substitute function in the edge fn coerces to "".
  const cleaned: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(variables)) {
    if (v !== undefined) cleaned[k] = v as string | number;
  }
  supabase.functions
    .invoke("send-booking-email", {
      body: { templateKey, recipientUserId, variables: cleaned },
    })
    .catch((err) => console.error(`send-booking-email[${templateKey}] failed:`, err));
}

/** Should we send an email for this bucket? Honors tenant policy + user prefs. */
async function shouldSendEmail(userId: string, eventType: string, actorId?: string): Promise<boolean> {
  const policy = await loadTenantPolicy().catch(() => null);
  const bucket = policy?.[eventType as keyof NonNullable<typeof policy>];
  if (bucket) {
    if (actorId && actorId === userId && bucket.notify_both === false) return false;
    if (bucket.channels.email === false) return false;
    const role = await resolveRecipientRole(userId);
    if (role && bucket.recipients[role] === false) return false;
  }
  const prefs = await loadPrefs(userId, eventType);
  return prefs.email_enabled !== false;
}

/**
 * Fan out a booking-status notification to BOTH the customer and the vendor.
 * The tenant policy decides whether the actor is filtered out.
 */
export async function notifyBookingTransition(
  transition: BookingTransition,
  ctx: TransitionContext,
): Promise<void> {
  const meta = { booking_id: ctx.bookingId };
  const provider = ctx.providerName ?? "your provider";
  const service = ctx.serviceName ?? "your service";
  const date = ctx.bookingDate ?? "";
  // Best-effort customer name lookup for email personalization.
  let customerName = "there";
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", ctx.customerId)
      .maybeSingle();
    customerName = (data?.display_name as string | undefined) ?? "there";
  } catch { /* ignore */ }

  const emailVars = {
    customerName,
    providerName: provider,
    serviceName: service,
    bookingDate: date,
    startTime: ctx.newTime ?? "",
    newDate: ctx.newDate ?? date,
    newTime: ctx.newTime ?? "",
    reasonSuffix: ctx.reason ? ` Reason: ${ctx.reason}` : "",
  };

  const maybeEmail = async (userId: string, key: string) => {
    if (await shouldSendEmail(userId, "bookings", ctx.actorId)) {
      sendBookingEmail(key, userId, emailVars);
    }
  };

  const send = (userId: string, role: "customer" | "vendor") => {
    switch (transition) {
      case "created":
        void maybeEmail(userId, role === "customer" ? "booking_created_customer" : "booking_created_vendor");
        return dispatchLocalized(
          userId,
          "booking_created",
          { providerName: provider, date, serviceName: service },
          role === "customer"
            ? { title: "Booking Requested ✨", message: `Your booking with ${provider}${date ? ` for ${date}` : ""} is pending confirmation.` }
            : { title: "New Booking Request", message: `You have a new booking request${date ? ` for ${date}` : ""}.` },
          meta,
          ctx.actorId,
        );
      case "accepted":
        void maybeEmail(userId, role === "customer" ? "booking_accepted_customer" : "booking_accepted_vendor");
        return dispatchLocalized(
          userId,
          "booking_accepted",
          { providerName: provider, date, serviceName: service },
          role === "customer"
            ? { title: "Booking Accepted ✅", message: `${provider} has accepted your booking${date ? ` for ${date}` : ""}.` }
            : { title: "Booking Accepted", message: `You accepted a booking${date ? ` for ${date}` : ""}.` },
          meta,
          ctx.actorId,
        );
      case "rejected":
        void maybeEmail(userId, role === "customer" ? "booking_rejected_customer" : "booking_rejected_vendor");
        return dispatchLocalized(
          userId,
          "booking_rejected",
          { providerName: provider, date, serviceName: service },
          role === "customer"
            ? { title: "Booking Declined", message: `${provider} can't take your booking${date ? ` on ${date}` : ""}.` }
            : { title: "Booking Declined", message: `You declined a booking${date ? ` on ${date}` : ""}.` },
          meta,
          ctx.actorId,
        );
      case "in_progress":
        void maybeEmail(userId, role === "customer" ? "booking_in_progress_customer" : "booking_in_progress_vendor");
        return dispatchLocalized(
          userId,
          "booking_in_progress",
          { providerName: provider, serviceName: service },
          role === "customer"
            ? { title: "Service Started 🔧", message: `${provider} has started working on your service.` }
            : { title: "Service Started", message: `You started "${service}".` },
          meta,
          ctx.actorId,
        );
      case "completed":
        void maybeEmail(userId, role === "customer" ? "booking_completed_customer" : "booking_completed_vendor");
        return dispatchLocalized(
          userId,
          "booking_completed",
          { serviceName: service, providerName: provider },
          role === "customer"
            ? { title: "Service Completed 🎉", message: `Your "${service}" booking has been marked complete.` }
            : { title: "Service Completed", message: `You marked "${service}" as complete.` },
          meta,
          ctx.actorId,
        );
      case "cancelled": {
        const reasonSuffix = ctx.reason ? ` Reason: ${ctx.reason}` : "";
        void maybeEmail(userId, role === "customer" ? "booking_cancelled_customer" : "booking_cancelled_vendor");
        return dispatchLocalized(
          userId,
          "booking_cancelled",
          { serviceName: service, date, reasonSuffix, providerName: provider },
          role === "customer"
            ? { title: "Booking Cancelled", message: `Your booking for "${service}"${date ? ` on ${date}` : ""} has been cancelled.${reasonSuffix}` }
            : { title: "Booking Cancelled", message: `A booking for "${service}"${date ? ` on ${date}` : ""} has been cancelled.${reasonSuffix}` },
          meta,
          ctx.actorId,
        );
      }
      case "rescheduled":
        void maybeEmail(userId, role === "customer" ? "booking_rescheduled_customer" : "booking_rescheduled_vendor");
        return dispatchLocalized(
          userId,
          "booking_rescheduled",
          { date: ctx.newDate ?? date, time: ctx.newTime ?? "", providerName: provider },
          { title: "Booking Rescheduled 🔄", message: `The booking has been moved to ${ctx.newDate ?? date}${ctx.newTime ? ` at ${ctx.newTime}` : ""}.` },
          meta,
          ctx.actorId,
        );
    }
  };

  await Promise.all([send(ctx.customerId, "customer"), send(ctx.vendorId, "vendor")]);
}

/**
 * Notify both parties about a payment event (success / refund). Vendor gets
 * a "payment_received", customer gets a "payment_success" / refund message.
 * The actor (usually the customer for a payment, an admin for a refund) is
 * filtered automatically when the payments bucket has `notify_both = false`.
 */
export async function notifyPaymentEvent(args: {
  bookingId: string;
  customerId: string;
  vendorId: string;
  actorId: string;
  amount: number;
  description: string;
  kind: "paid" | "refunded";
}): Promise<void> {
  const meta = { booking_id: args.bookingId, amount: args.amount };

  // Best-effort name lookups so the email feels personal.
  let customerName = "there";
  let providerName = "there";
  try {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", [args.customerId, args.vendorId]);
    for (const row of data ?? []) {
      const r = row as { user_id: string; display_name: string | null };
      if (r.user_id === args.customerId) customerName = r.display_name ?? customerName;
      if (r.user_id === args.vendorId) providerName = r.display_name ?? providerName;
    }
  } catch { /* ignore */ }

  const emailVars = {
    customerName,
    providerName,
    amount: formatMoney(args.amount),
    description: args.description,
  };

  const maybeEmail = async (userId: string, key: string) => {
    if (await shouldSendEmail(userId, "payments", args.actorId)) {
      sendBookingEmail(key, userId, emailVars);
    }
  };

  if (args.kind === "paid") {
    void maybeEmail(args.customerId, "payment_paid_customer");
    void maybeEmail(args.vendorId, "payment_paid_vendor");
    await Promise.all([
      dispatchLocalized(
        args.customerId,
        "payment_success",
        { amount: formatMoney(args.amount), description: args.description },
        { title: "Payment Successful 💳", message: `Your payment of ${formatMoney(args.amount)} for ${args.description} was processed.` },
        meta,
        args.actorId,
      ),
      dispatchLocalized(
        args.vendorId,
        "payment_received",
        { amount: formatMoney(args.amount), description: args.description },
        { title: "Payment Received 💰", message: `You received ${formatMoney(args.amount)} for ${args.description}.` },
        meta,
        args.actorId,
      ),
    ]);
    return;
  }

  // refund
  void maybeEmail(args.customerId, "payment_refunded_customer");
  void maybeEmail(args.vendorId, "payment_refunded_vendor");
  await Promise.all([
    createNotification({
      userId: args.customerId,
      type: "payment_success",
      title: "Refund Processed 💸",
      message: `A refund of ${formatMoney(args.amount)} for ${args.description} has been credited.`,
      metadata: meta,
      actorId: args.actorId,
    }),
    createNotification({
      userId: args.vendorId,
      type: "payment_received",
      title: "Refund Issued",
      message: `A refund of ${formatMoney(args.amount)} was issued for ${args.description}.`,
      metadata: meta,
      actorId: args.actorId,
    }),
  ]);
}

/* ═══════════════════════════════════════════
   Vendor verification review notifications
   ═══════════════════════════════════════════ */

async function sendVerificationEmail(
  templateKey:
    | "verification_approved"
    | "verification_rejected"
    | "verification_info_requested"
    | "verification_resubmitted",
  recipientUserId: string,
  variables: Record<string, string | number | null | undefined>,
) {
  try {
    await supabase.functions.invoke("send-booking-email", {
      body: { templateKey, recipientUserId, variables },
    });
  } catch (e) {
    console.warn(`Verification email (${templateKey}) failed:`, e);
  }
}

export async function notifyVerificationApproved(args: {
  vendorId: string;
  vendorName?: string;
  businessName?: string | null;
  verificationId: string;
  actorId?: string;
}) {
  const business = args.businessName || args.vendorName || "your business";
  await Promise.all([
    createNotification({
      userId: args.vendorId,
      type: "verification_approved",
      title: "You're verified! 🎉",
      message: `${business} is now verified. A "Verified" badge appears on your profile.`,
      metadata: { verification_id: args.verificationId, status: "approved" },
      actorId: args.actorId,
    }),
    sendVerificationEmail("verification_approved", args.vendorId, {
      vendor_name: args.vendorName ?? "there",
      business_name: business,
      verification_id: args.verificationId,
    }),
  ]);
}

export async function notifyVerificationRejected(args: {
  vendorId: string;
  vendorName?: string;
  businessName?: string | null;
  verificationId: string;
  rejectionNote?: string | null;
  rejectionReasons?: string[];
  actorId?: string;
}) {
  const reasons = (args.rejectionReasons ?? []).filter(Boolean);
  const summary =
    args.rejectionNote?.trim() ||
    (reasons.length ? reasons.join("; ") : "Please review the requested fixes and resubmit.");
  await Promise.all([
    createNotification({
      userId: args.vendorId,
      type: "verification_rejected",
      title: "Verification needs changes",
      message: summary,
      metadata: {
        verification_id: args.verificationId,
        status: "rejected",
        rejection_reasons: reasons,
      },
      actorId: args.actorId,
    }),
    sendVerificationEmail("verification_rejected", args.vendorId, {
      vendor_name: args.vendorName ?? "there",
      business_name: args.businessName ?? "",
      rejection_note: args.rejectionNote ?? "",
      rejection_reasons: reasons.join(", "),
      verification_id: args.verificationId,
    }),
  ]);
}

export async function notifyVerificationInfoRequested(args: {
  vendorId: string;
  vendorName?: string;
  businessName?: string | null;
  verificationId: string;
  infoRequestNote: string;
  actorId?: string;
}) {
  await Promise.all([
    createNotification({
      userId: args.vendorId,
      type: "verification_info_requested",
      title: "More info needed for verification",
      message: args.infoRequestNote,
      metadata: {
        verification_id: args.verificationId,
        status: "info_requested",
        info_request_note: args.infoRequestNote,
      },
      actorId: args.actorId,
    }),
    sendVerificationEmail("verification_info_requested", args.vendorId, {
      vendor_name: args.vendorName ?? "there",
      business_name: args.businessName ?? "",
      info_request_note: args.infoRequestNote,
      verification_id: args.verificationId,
    }),
  ]);
}

export async function notifyVerificationResubmitted(args: {
  vendorId: string;
  vendorName?: string;
  businessName?: string | null;
  verificationId: string;
  actorId?: string;
}) {
  const business = args.businessName || args.vendorName || "your business";
  await Promise.all([
    createNotification({
      userId: args.vendorId,
      type: "verification_resubmitted",
      title: "Resubmission received",
      message: `We've received the updated verification for ${business}. Our team will review it shortly.`,
      metadata: {
        verification_id: args.verificationId,
        status: "pending",
        resubmitted: true,
      },
      actorId: args.actorId,
    }),
    sendVerificationEmail("verification_resubmitted", args.vendorId, {
      vendor_name: args.vendorName ?? "there",
      business_name: business,
      verification_id: args.verificationId,
    }),
  ]);
}
