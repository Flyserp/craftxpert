/**
 * Centralized API endpoint registry.
 *
 * Web and future native (Capacitor) clients MUST import paths from this file
 * — never hardcode REST/RPC/edge-function URLs in components.
 *
 * Tables / RPCs map to PostgREST automatically; edge functions are invoked
 * via supabase.functions.invoke(name) or by composing FUNCTIONS_BASE + name.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const API = {
  REST_BASE: `${SUPABASE_URL}/rest/v1`,
  FUNCTIONS_BASE: `${SUPABASE_URL}/functions/v1`,
  STORAGE_BASE: `${SUPABASE_URL}/storage/v1`,
  REALTIME_BASE: `${SUPABASE_URL}/realtime/v1`,
} as const;

/** Postgres tables exposed via PostgREST (use supabase.from(TABLES.x)) */
export const TABLES = {
  profiles: "profiles",
  userRoles: "user_roles",
  vendorServices: "vendor_services",
  tasks: "tasks",
  taskProposals: "task_proposals",
  bookings: "bookings",
  reviews: "reviews",
  notifications: "notifications",
  wallets: "wallets",
  walletTransactions: "wallet_transactions",
  conversations: "conversations",
  messages: "messages",
  deviceTokens: "device_tokens",
  advertisements: "advertisements",
  banners: "banners",
  homepageContent: "homepage_content",
  cmsPages: "cms_pages",
  platformSettings: "platform_settings",
} as const;

/** RPC functions (use supabase.rpc(RPC.x, args)) */
export const RPC = {
  hasRole: "has_role",
  hasActiveSubscription: "has_active_subscription",
  sponsorVendorService: "sponsor_vendor_service",
  adminPromoteService: "admin_promote_service",
  adminRemoveServicePromotion: "admin_remove_service_promotion",
  approveRefund: "approve_refund",
  markWithdrawalPaid: "mark_withdrawal_paid",
  renewTask: "renew_task",
  searchSuggestions: "search_suggestions",
  popularSearches: "popular_searches",
  recordAdEvent: "record_ad_event",
  logLoginEvent: "log_login_event",
} as const;

/** Lovable-managed edge functions */
export const FUNCTIONS = {
  
  sendPush: "send-push",
  registerDevice: "register-device",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
export type RpcName = (typeof RPC)[keyof typeof RPC];
export type FunctionName = (typeof FUNCTIONS)[keyof typeof FUNCTIONS];