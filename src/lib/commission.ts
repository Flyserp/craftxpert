import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_COMMISSION_RATE = 10;

type CommissionConfig = {
  type: "percent" | "fixed";
  percent: number;
  fixed: number;
  overrides: Record<string, { type: "percent" | "fixed"; value: number }>;
};

let cachedRate: { rate: number; at: number } | null = null;
let cachedConfig: { cfg: CommissionConfig; at: number } | null = null;
const TTL_MS = 60_000;

export async function getCommissionRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.at < TTL_MS) return cachedRate.rate;
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "platform_commission_rate")
    .maybeSingle();
  const parsed = data?.value ? Number(data.value) : NaN;
  const rate = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_COMMISSION_RATE;
  cachedRate = { rate, at: Date.now() };
  return rate;
}

export const calcCommission = (amount: number, rate: number) =>
  Math.max(0, amount) * (rate / 100);

export async function getCommissionConfig(): Promise<CommissionConfig> {
  if (cachedConfig && Date.now() - cachedConfig.at < TTL_MS) return cachedConfig.cfg;

  const [{ data: settings }, { data: overrides }] = await Promise.all([
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["platform_commission_rate", "platform_commission_type", "platform_commission_fixed"]),
    supabase.from("category_commissions").select("category_id, commission_type, commission_value"),
  ]);

  const map = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));
  const percent = Number(map.platform_commission_rate);
  const fixed = Number(map.platform_commission_fixed);
  const type = (map.platform_commission_type === "fixed" ? "fixed" : "percent") as "percent" | "fixed";

  const cfg: CommissionConfig = {
    type,
    percent: Number.isFinite(percent) && percent >= 0 ? percent : DEFAULT_COMMISSION_RATE,
    fixed: Number.isFinite(fixed) && fixed >= 0 ? fixed : 0,
    overrides: Object.fromEntries(
      (overrides || []).map((o: any) => [
        o.category_id,
        { type: o.commission_type, value: Number(o.commission_value) || 0 },
      ]),
    ),
  };
  cachedConfig = { cfg, at: Date.now() };
  return cfg;
}

export function computeCommission(
  amount: number,
  cfg: CommissionConfig,
  categoryId?: string | null,
): number {
  const base = Math.max(0, Number(amount) || 0);
  const override = categoryId ? cfg.overrides[categoryId] : undefined;
  if (override) {
    return override.type === "fixed"
      ? Math.min(base, override.value)
      : base * (override.value / 100);
  }
  return cfg.type === "fixed" ? Math.min(base, cfg.fixed) : base * (cfg.percent / 100);
}
