import { supabase } from "@/integrations/supabase/client";
import { FUNCTIONS, type FunctionName } from "./endpoints";

/**
 * Unified API client used by both web and (future) native mobile shells.
 *
 * - Reuses the Supabase JS client so tokens, refresh, and realtime stay
 *   consistent across platforms.
 * - Normalizes errors into { ok, data, error } so mobile callers don't have
 *   to special-case PostgrestError vs FunctionsHttpError.
 */

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error: { message: string; code?: string; status?: number } | null;
}

function normalizeError(err: unknown): ApiResult<never>["error"] {
  if (!err) return null;
  const e = err as { message?: string; code?: string; status?: number };
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code,
    status: e?.status,
  };
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function invokeFunction<TBody = unknown, TRes = unknown>(
  name: FunctionName | (string & {}),
  body?: TBody,
): Promise<ApiResult<TRes>> {
  const { data, error } = await supabase.functions.invoke<TRes>(name, { body });
  return {
    ok: !error,
    data: (data as TRes) ?? null,
    error: normalizeError(error),
  };
}

/** Selects only the fields the mobile UI needs — keeps payloads small. */
export function selectFields<T extends string>(...fields: T[]): string {
  return fields.join(",");
}

/** Standard mobile-friendly pagination defaults. */
export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 50,
} as const;

export function range(page: number, pageSize = PAGINATION.defaultPageSize) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export { FUNCTIONS };