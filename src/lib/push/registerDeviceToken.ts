import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/api/endpoints";

export type DevicePlatform = "ios" | "android" | "web";

export interface RegisterDeviceTokenInput {
  token: string;
  platform: DevicePlatform;
  appVersion?: string;
  deviceModel?: string;
  locale?: string;
}

/**
 * Upsert an FCM (or web push) token for the signed-in user.
 *
 * In the future native Capacitor app, call this after
 * `PushNotifications.addListener('registration', ...)`.
 */
export async function registerDeviceToken(input: RegisterDeviceTokenInput) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from(TABLES.deviceTokens).upsert(
    {
      user_id: user.id,
      token: input.token,
      platform: input.platform,
      app_version: input.appVersion ?? null,
      device_model: input.deviceModel ?? null,
      locale: input.locale ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );

  return { ok: !error, error: error?.message ?? null };
}

export async function unregisterDeviceToken(token: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from(TABLES.deviceTokens)
    .delete()
    .eq("user_id", user.id)
    .eq("token", token);

  return { ok: !error, error: error?.message ?? null };
}