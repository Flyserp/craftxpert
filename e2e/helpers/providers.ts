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
 * Email resolution (in order):
 *   1. E2E_CLIENT_EMAIL env var (explicit override)
 *   2. The display_name of the first profile whose user has the `client` role
 *      — joined against user_roles via the public profiles table. Since auth.users
 *      isn't readable with the anon key, we use display_name as the email when it
 *      looks like one; otherwise we fall back to the well-known seed account.
 *   3. "client@demo.com" (the canonical seeded demo client)
 *
 * Passwords cannot be read from the DB (Supabase hashes them in auth.users), so
 * the password comes from E2E_CLIENT_PASSWORD or the documented demo default.
 */
export async function getFirstClientCredentials(
  client: Pick<typeof supabase, "from"> = supabase,
): Promise<TestCredentials> {
  const password = process.env.E2E_CLIENT_PASSWORD ?? "Client123!";

  const envEmail = process.env.E2E_CLIENT_EMAIL;
  if (envEmail) return { email: envEmail, password };

  // Try to find a profile whose user_id has the `client` role and whose
  // display_name happens to be an email (some seeds store the email there).
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

  // Final fallback: the documented demo seed account.
  return { email: "client@demo.com", password };
}

/**
 * Returns credentials for a seeded admin account. Mirrors the client helper:
 * env override first, then a DB-driven email lookup, then the documented demo
 * fallback (admin@demo.com / Admin123!).
 */
export async function getFirstAdminCredentials(): Promise<TestCredentials> {
  const password = process.env.E2E_ADMIN_PASSWORD ?? "Admin123!";

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

  return { email: "admin@demo.com", password };
}
