import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Returns the vendor_id of the first provider that has at least one active
 * vendor_service. Stable across seed changes — the test suite no longer
 * hard-codes a UUID. Throws if none exist (the seed is broken).
 */
export async function getFirstActiveProviderId(): Promise<string> {
  const { data, error } = await supabase
    .from("vendor_services")
    .select("vendor_id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch active provider: ${error.message}`);
  if (!data?.vendor_id) throw new Error("No active provider with services found in DB.");
  return data.vendor_id;
}

export interface TestCredentials {
  email: string;
  password: string;
}

/**
 * Returns credentials for a seeded client account.
 *
 * Requires E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD env vars. Falls back to a
 * DB-driven email lookup when only the password is provided. Throws when no
 * email can be resolved so tests fail fast instead of hitting a stale account.
 */
export async function getFirstClientCredentials(
  client: Pick<typeof supabase, "from"> = supabase,
): Promise<TestCredentials> {
  const password = process.env.E2E_CLIENT_PASSWORD;
  if (!password) throw new Error("E2E_CLIENT_PASSWORD is not set");

  const envEmail = process.env.E2E_CLIENT_EMAIL;
  if (envEmail) return { email: envEmail, password };

  const { data: roles } = await client
    .from("user_roles")
    .select("user_id")
    .eq("role", "client")
    .limit(20);

  const userIds = (roles ?? []).map((r) => r.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("display_name")
      .in("user_id", userIds);

    const emailLike = profiles?.find((p) =>
      typeof p.display_name === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.display_name)
    );
    if (emailLike?.display_name) return { email: emailLike.display_name, password };
  }

  throw new Error("No client email could be resolved. Set E2E_CLIENT_EMAIL.");
}

/**
 * Returns credentials for a seeded admin account. Mirrors the client helper:
 * env override first, then a DB-driven email lookup. Throws when no email can
 * be resolved.
 */
export async function getFirstAdminCredentials(): Promise<TestCredentials> {
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is not set");

  const envEmail = process.env.E2E_ADMIN_EMAIL;
  if (envEmail) return { email: envEmail, password };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(20);

  const userIds = (roles ?? []).map((r) => r.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("display_name")
      .in("user_id", userIds);

    const emailLike = profiles?.find((p) =>
      typeof p.display_name === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.display_name)
    );
    if (emailLike?.display_name) return { email: emailLike.display_name, password };
  }

  throw new Error("No admin email could be resolved. Set E2E_ADMIN_EMAIL.");
}
