import { supabase } from "@/integrations/supabase/client";

/**
 * Booking deposit percentage resolution:
 *   1. Category-specific override on `category_commissions.deposit_percentage`
 *   2. Platform-wide default at `platform_settings.booking_deposit_percentage`
 *   3. Hardcoded fallback of 25%
 */
export const DEFAULT_DEPOSIT_PERCENTAGE = 25;

let cachedDefault: { pct: number; at: number } | null = null;
const overrideCache = new Map<string, { pct: number | null; at: number }>();
const TTL_MS = 60_000;

async function getPlatformDefault(): Promise<number> {
  if (cachedDefault && Date.now() - cachedDefault.at < TTL_MS) return cachedDefault.pct;
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "booking_deposit_percentage")
    .maybeSingle();
  const parsed = data?.value ? Number(data.value) : NaN;
  const pct =
    Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
      ? parsed
      : DEFAULT_DEPOSIT_PERCENTAGE;
  cachedDefault = { pct, at: Date.now() };
  return pct;
}

async function getCategoryOverride(categoryId: string): Promise<number | null> {
  const cached = overrideCache.get(categoryId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.pct;
  const { data } = await supabase
    .from("category_commissions")
    .select("deposit_percentage")
    .eq("category_id", categoryId)
    .maybeSingle();
  const raw = (data as any)?.deposit_percentage;
  const parsed = raw == null ? null : Number(raw);
  const pct =
    parsed != null && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
      ? parsed
      : null;
  overrideCache.set(categoryId, { pct, at: Date.now() });
  return pct;
}

export async function getDepositPercentage(categoryId?: string | null): Promise<number> {
  if (categoryId) {
    const override = await getCategoryOverride(categoryId);
    if (override != null) return override;
  }
  return getPlatformDefault();
}

export const calcDeposit = (amount: number, pct: number) =>
  Math.round(Math.max(0, amount) * (pct / 100) * 100) / 100;
