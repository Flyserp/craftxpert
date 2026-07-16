import { supabase } from "@/integrations/supabase/client";

/**
 * Standardized auth surface shared by web and (future) native mobile shells.
 *
 * All flows go through the Supabase JS client so token refresh and persisted
 * sessions work identically in browsers and Capacitor WebViews.
 */

export interface AuthResult {
  ok: boolean;
  error: string | null;
}

function err(e: unknown): string {
  return (e as { message?: string })?.message ?? "Authentication failed";
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { ok: !error, error: error ? err(error) : null };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  metadata?: Record<string, unknown>,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: metadata,
    },
  });
  return { ok: !error, error: error ? err(error) : null };
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  return { ok: !error, error: error ? err(error) : null };
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(
  cb: (event: string, session: unknown) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) =>
    cb(event, session),
  );
  return () => data.subscription.unsubscribe();
}