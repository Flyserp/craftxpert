import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TestCredentials } from "./providers";

/**
 * Deterministic notification seeding for e2e tests.
 *
 * Background — what this helper is *not*:
 *   The original test idea was "seed unread notifications for tenant A and
 *   tenant B". The current `public.notifications` schema in this project is
 *   scoped only by `user_id` (there is no `tenant_id` column, and the
 *   tenants/tenant_members tables don't exist in the active database). So
 *   "tenant A vs tenant B" maps cleanly onto **user A vs user B** — each
 *   user is the unit of isolation for notifications.
 *
 * What this helper *is*:
 *   - Signs in as a given user (using the anon client with their password).
 *   - Wipes any pre-existing unread notifications for that user so prior
 *     test runs can't bleed in.
 *   - Inserts an exact `unreadCount` of fresh unread notifications.
 *   - Returns the precise count actually present after seeding so tests can
 *     assert the badge equals it without guessing.
 *
 * Two-user usage: call `seedUnreadNotifications` for `userA`, then for
 * `userB`. Each call is independent and uses a fresh anon-key Supabase
 * client; sessions don't bleed across calls.
 *
 * Same-user-multi-tenant usage: see `seedSameUserMultiTenantUnread`. It
 * seeds one user with two distinct tenant-tagged batches (different counts
 * per tenant) so tenant-scoped badge isolation can be proven deterministically
 * even though notifications currently lack a `tenant_id` column.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

/** A unique tag we attach to every notification we create, so cleanup is
 *  surgical and never touches real notifications. */
export const E2E_SEED_TAG = "e2e_notification_seed";
/** Metadata key used to scope a seeded notification to a synthetic tenant. */
export const E2E_TENANT_KEY = "e2e_tenant_slug";

export interface SeedResult {
  /** Auth user id of the signed-in account. */
  userId: string;
  /** Number of unread notifications confirmed in the DB after seeding. */
  unreadCount: number;
  /** IDs of the rows we created (useful for targeted teardown). */
  insertedIds: string[];
}

async function signInAs(creds: TestCredentials): Promise<{
  client: SupabaseClient;
  userId: string;
}> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error || !data.user) {
    throw new Error(
      `seedUnreadNotifications: sign-in failed for ${creds.email}: ${
        error?.message ?? "no user"
      }`,
    );
  }
  return { client, userId: data.user.id };
}

/**
 * Mark every prior seed-tagged unread notification for the user as read.
 * Untagged (real) notifications are left untouched.
 *
 * Note: the project's RLS does NOT grant DELETE on `notifications` to the
 * row owner. We can't remove rows with the anon key, so we mark them read
 * to keep unread counts deterministic. New seeded rows will be the only
 * unread ones for this user.
 */
async function clearPriorSeedUnread(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  await client
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .contains("metadata", { [E2E_SEED_TAG]: true });
}

export interface SeedOptions {
  /** How many unread notifications to create. */
  unreadCount: number;
  /** Optional label to identify this batch in metadata (e.g. "tenantA"). */
  label?: string;
  /**
   * If true (default), mark all OTHER unread notifications for this user
   * as read so the badge count is exactly `unreadCount` after seeding.
   * Set to false if you want to preserve organic unread notifications.
   */
  resetExistingUnread?: boolean;
  /** Optional tenant slug to tag every row with (used by per-tenant tests). */
  tenantSlug?: string;
}

/**
 * Seed `options.unreadCount` unread notifications for the given user and
 * return the resulting unread total. Idempotent across runs.
 */
export async function seedUnreadNotifications(
  creds: TestCredentials,
  options: SeedOptions,
): Promise<SeedResult> {
  if (!Number.isInteger(options.unreadCount) || options.unreadCount < 0) {
    throw new Error(
      `seedUnreadNotifications: unreadCount must be a non-negative integer (got ${options.unreadCount})`,
    );
  }

  const { client, userId } = await signInAs(creds);
  const label = options.label ?? "e2e";
  const resetExisting = options.resetExistingUnread ?? true;

  try {
    // Always sweep our own prior seed rows back to read.
    await clearPriorSeedUnread(client, userId);

    // Optionally also mark organic unread notifications as read so the badge
    // count is exactly the seeded value (no off-by-real-traffic noise).
    if (resetExisting) {
      await client
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    }

    const insertedIds: string[] = [];
    if (options.unreadCount > 0) {
      const rows = Array.from({ length: options.unreadCount }, (_, i) => ({
        user_id: userId,
        type: "info",
        title: `[e2e:${label}] Seeded notification ${i + 1}`,
        message: `Deterministic test fixture #${i + 1} for ${creds.email}`,
        is_read: false,
        metadata: {
          [E2E_SEED_TAG]: true,
          seed_label: label,
          seed_index: i,
          seeded_at: new Date().toISOString(),
          ...(options.tenantSlug ? { [E2E_TENANT_KEY]: options.tenantSlug } : {}),
        },
      }));

      const { data, error } = await client
        .from("notifications")
        .insert(rows)
        .select("id");

      if (error) {
        throw new Error(
          `seedUnreadNotifications: insert failed for ${creds.email}: ${error.message}`,
        );
      }
      insertedIds.push(...(data ?? []).map((r: { id: string }) => r.id));
    }

    // Authoritative re-count from the DB so the test asserts against truth,
    // not against what we *intended* to insert.
    const { count, error: countError } = await client
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (countError) {
      throw new Error(
        `seedUnreadNotifications: post-seed count failed: ${countError.message}`,
      );
    }

    return { userId, unreadCount: count ?? 0, insertedIds };
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

/**
 * Convenience: seed two users (e.g. one per "tenant") in a single call.
 * Returns each user's confirmed unread count for assertions.
 */
export async function seedTwoUserUnread(
  a: { creds: TestCredentials; unreadCount: number; label?: string },
  b: { creds: TestCredentials; unreadCount: number; label?: string },
): Promise<{ a: SeedResult; b: SeedResult }> {
  const seedA = await seedUnreadNotifications(a.creds, {
    unreadCount: a.unreadCount,
    label: a.label ?? "userA",
  });
  const seedB = await seedUnreadNotifications(b.creds, {
    unreadCount: b.unreadCount,
    label: b.label ?? "userB",
  });

  if (seedA.userId === seedB.userId) {
    throw new Error(
      "seedTwoUserUnread: both credentials resolved to the same auth user — isolation test would be meaningless.",
    );
  }

  return { a: seedA, b: seedB };
}

export interface SameUserMultiTenantSeedResult {
  /** Auth user id of the single signed-in account. */
  userId: string;
  /** Per-tenant breakdown — exactly what was inserted, keyed by slug. */
  tenants: Record<
    string,
    {
      slug: string;
      label: string;
      unreadCount: number;
      insertedIds: string[];
    }
  >;
  /** Total unread for the user across all tenants (= sum of per-tenant). */
  totalUnreadCount: number;
}

export interface TenantSeedSpec {
  slug: string;
  unreadCount: number;
  label?: string;
}

/**
 * Seed ONE user with multiple tenant-tagged unread batches.
 *
 * This is the deterministic fixture for "same user, different tenants,
 * different unread counts" badge-isolation tests. Every row carries:
 *   metadata.e2e_notification_seed = true
 *   metadata.e2e_tenant_slug       = "<slug>"
 *
 * That lets the test compute the *per-tenant* unread truth via:
 *   .eq("user_id", userId)
 *   .eq("is_read", false)
 *   .contains("metadata", { e2e_tenant_slug: "<slug>" })
 *
 * Tenant slugs MUST be distinct, and counts SHOULD differ — otherwise the
 * isolation assertion would pass trivially even if leaks existed.
 */
export async function seedSameUserMultiTenantUnread(
  creds: TestCredentials,
  tenants: TenantSeedSpec[],
): Promise<SameUserMultiTenantSeedResult> {
  if (tenants.length < 2) {
    throw new Error(
      `seedSameUserMultiTenantUnread: need at least 2 tenants (got ${tenants.length}).`,
    );
  }
  const slugs = tenants.map((t) => t.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error(
      `seedSameUserMultiTenantUnread: tenant slugs must be unique (got ${slugs.join(", ")}).`,
    );
  }
  for (const t of tenants) {
    if (!Number.isInteger(t.unreadCount) || t.unreadCount < 0) {
      throw new Error(
        `seedSameUserMultiTenantUnread: tenant "${t.slug}" unreadCount must be a non-negative integer (got ${t.unreadCount}).`,
      );
    }
  }
  const counts = tenants.map((t) => t.unreadCount);
  if (new Set(counts).size === 1) {
    throw new Error(
      `seedSameUserMultiTenantUnread: tenants share the same unreadCount (${counts[0]}); the leak check would be meaningless.`,
    );
  }

  const { client, userId } = await signInAs(creds);
  try {
    // Reset everything once up-front so per-tenant counts are exact.
    await clearPriorSeedUnread(client, userId);
    await client
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    const result: SameUserMultiTenantSeedResult = {
      userId,
      tenants: {},
      totalUnreadCount: 0,
    };

    for (const t of tenants) {
      const label = t.label ?? `tenant-${t.slug}`;
      const insertedIds: string[] = [];

      if (t.unreadCount > 0) {
        const rows = Array.from({ length: t.unreadCount }, (_, i) => ({
          user_id: userId,
          type: "info",
          title: `[e2e:${label}] Seeded notification ${i + 1}`,
          message: `Deterministic per-tenant fixture #${i + 1} (${t.slug}) for ${creds.email}`,
          is_read: false,
          metadata: {
            [E2E_SEED_TAG]: true,
            [E2E_TENANT_KEY]: t.slug,
            seed_label: label,
            seed_index: i,
            seeded_at: new Date().toISOString(),
          },
        }));
        const { data, error } = await client
          .from("notifications")
          .insert(rows)
          .select("id");
        if (error) {
          throw new Error(
            `seedSameUserMultiTenantUnread: insert failed for tenant ${t.slug}: ${error.message}`,
          );
        }
        insertedIds.push(...(data ?? []).map((r: { id: string }) => r.id));
      }

      // Per-tenant authoritative recount — proves the metadata filter works.
      const { count, error: countError } = await client
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .contains("metadata", { [E2E_TENANT_KEY]: t.slug });
      if (countError) {
        throw new Error(
          `seedSameUserMultiTenantUnread: per-tenant recount failed for ${t.slug}: ${countError.message}`,
        );
      }
      const confirmed = count ?? 0;
      if (confirmed !== t.unreadCount) {
        throw new Error(
          `seedSameUserMultiTenantUnread: tenant ${t.slug} expected ${t.unreadCount} unread, DB reports ${confirmed}.`,
        );
      }

      result.tenants[t.slug] = {
        slug: t.slug,
        label,
        unreadCount: confirmed,
        insertedIds,
      };
      result.totalUnreadCount += confirmed;
    }

    // Cross-check: total unread for the user equals the sum of per-tenant.
    const { count: total, error: totalError } = await client
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (totalError) {
      throw new Error(
        `seedSameUserMultiTenantUnread: total recount failed: ${totalError.message}`,
      );
    }
    if ((total ?? 0) !== result.totalUnreadCount) {
      throw new Error(
        `seedSameUserMultiTenantUnread: total unread mismatch (DB=${total}, sum=${result.totalUnreadCount}). Untagged unread leaked in.`,
      );
    }

    return result;
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

/**
 * Re-count unread per tenant slug for the given user. Used by tests as the
 * ground truth for what the badge SHOULD show in a tenant-scoped UI.
 */
export async function fetchPerTenantUnread(
  creds: TestCredentials,
  slug: string,
): Promise<number> {
  const { client, userId } = await signInAs(creds);
  try {
    const { count, error } = await client
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .contains("metadata", { [E2E_TENANT_KEY]: slug });
    if (error) {
      throw new Error(
        `fetchPerTenantUnread: count failed for ${creds.email}/${slug}: ${error.message}`,
      );
    }
    void userId;
    return count ?? 0;
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

/**
 * Best-effort teardown: marks all seed-tagged notifications for the given
 * user as read. Safe to call from `test.afterAll`. Does not throw.
 */
export async function resetSeededUnread(
  creds: TestCredentials,
): Promise<void> {
  try {
    const { client, userId } = await signInAs(creds);
    await clearPriorSeedUnread(client, userId);
    await client.auth.signOut().catch(() => {});
  } catch {
    /* swallow — teardown must not fail the suite */
  }
}
