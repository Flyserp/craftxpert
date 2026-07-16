/**
 * Tenant-level notification policy.
 *
 * Stored as a single JSON row in `platform_settings` (key = "notifications.tenant_policy")
 * so admins can edit it without a schema change. Read by all clients (non-secret),
 * written only by admins via RLS.
 *
 * Shape:
 *   {
 *     "<eventBucket>": {
 *       channels: { in_app: bool, email: bool, sms: bool },
 *       recipients: { customer: bool, provider: bool, admin: bool }
 *     }
 *   }
 */

import { supabase } from "@/integrations/supabase/client";

export type RecipientRole = "customer" | "provider" | "admin";
export type ChannelKey = "in_app" | "email" | "sms";

export const EVENT_BUCKETS = [
  { key: "bookings", label: "Bookings", desc: "New, accepted, in-progress, completed, rescheduled, cancelled" },
  { key: "messages", label: "Messages", desc: "New chat messages" },
  { key: "reviews",  label: "Reviews",  desc: "Review reminders and replies" },
  { key: "payments", label: "Payments & Wallet", desc: "Receipts, refunds, withdrawals" },
  { key: "marketing", label: "Promotions", desc: "Coupons, deals, product updates" },
] as const;

export type EventBucketKey = typeof EVENT_BUCKETS[number]["key"];

export interface BucketPolicy {
  channels: Record<ChannelKey, boolean>;
  recipients: Record<RecipientRole, boolean>;
  /**
   * When true, both the actor (the user who triggered the event) and the other
   * party are notified. When false (default), only the OTHER party is notified
   * — the actor doesn't get a notification about their own action.
   * Only applies to events that have a clear actor (e.g. provider accepts a
   * booking → customer is the "other party").
   */
  notify_both: boolean;
}

export type TenantPolicy = Record<EventBucketKey, BucketPolicy>;

export const POLICY_SETTING_KEY = "notifications.tenant_policy";

/** Sensible defaults: most channels on for the affected party; marketing opt-in. */
export const DEFAULT_TENANT_POLICY: TenantPolicy = {
  bookings:  {
    channels:   { in_app: true, email: true,  sms: false },
    recipients: { customer: true, provider: true, admin: false },
    notify_both: false,
  },
  messages:  {
    channels:   { in_app: true, email: false, sms: false },
    recipients: { customer: true, provider: true, admin: false },
    notify_both: false,
  },
  reviews:   {
    channels:   { in_app: true, email: true,  sms: false },
    recipients: { customer: true, provider: true, admin: false },
    notify_both: false,
  },
  payments:  {
    channels:   { in_app: true, email: true,  sms: false },
    recipients: { customer: true, provider: true, admin: true },
    notify_both: true,
  },
  marketing: {
    channels:   { in_app: true, email: false, sms: false },
    recipients: { customer: true, provider: true, admin: false },
    notify_both: false,
  },
};

/** In-memory cache to avoid hitting platform_settings on every notification. */
let cache: { value: TenantPolicy; fetchedAt: number } | null = null;
const CACHE_MS = 60_000; // 1 minute

function mergeWithDefaults(raw: unknown): TenantPolicy {
  const base = JSON.parse(JSON.stringify(DEFAULT_TENANT_POLICY)) as TenantPolicy;
  if (!raw || typeof raw !== "object") return base;
  for (const k of Object.keys(base) as EventBucketKey[]) {
    const incoming = (raw as any)[k];
    if (!incoming) continue;
    if (incoming.channels)   base[k].channels   = { ...base[k].channels,   ...incoming.channels };
    if (incoming.recipients) base[k].recipients = { ...base[k].recipients, ...incoming.recipients };
    if (typeof incoming.notify_both === "boolean") base[k].notify_both = incoming.notify_both;
  }
  return base;
}

export async function loadTenantPolicy(force = false): Promise<TenantPolicy> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.value;
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", POLICY_SETTING_KEY)
    .maybeSingle();

  let parsed: unknown = null;
  if (data?.value) {
    try { parsed = JSON.parse(data.value); } catch { parsed = null; }
  }
  const merged = mergeWithDefaults(parsed);
  cache = { value: merged, fetchedAt: Date.now() };
  return merged;
}

export async function saveTenantPolicy(policy: TenantPolicy): Promise<void> {
  const { error } = await supabase
    .from("platform_settings")
    .upsert(
      { key: POLICY_SETTING_KEY, value: JSON.stringify(policy), is_secret: false },
      { onConflict: "key" },
    );
  if (error) throw error;
  cache = { value: policy, fetchedAt: Date.now() };
}

export function invalidateTenantPolicyCache() {
  cache = null;
}
