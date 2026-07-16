// Authenticated endpoint that triggers an employer's re-verification flow.
// - Validates JWT (function is deployed with verify_jwt = false; we validate in code).
// - Confirms the target vendor_verifications row belongs to the caller.
// - Requires all mandatory documents to be present.
// - Transitions the row to `pending`, extends `expires_at` by 1 year, stamps
//   `submitted_at`, clears rejection/info-request state.
// - Notifies routed admins/moderators and records an audit entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_DOC_KEYS = [
  "government_id_url",
  "proof_of_address_url",
  "police_clearance_url",
] as const;

const MAX_TEXT = 200;
const clean = (v: unknown, max = MAX_TEXT): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT — extract caller from the bearer token
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "Missing Authorization bearer token" }, 401);

    const authed = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
    const userId = userRes.user.id;

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const verificationId = clean(body.verification_id, 64);
    const businessName = clean(body.business_name);
    const legalName = clean(body.legal_name);
    if (!verificationId) return json({ error: "verification_id is required" }, 400);
    if (!businessName || !legalName) {
      return json({ error: "business_name and legal_name are required" }, 400);
    }

    // Service client for privileged reads/writes (RLS enforced by ownership check below)
    const admin = createClient(url, service);

    const { data: row, error: rowErr } = await admin
      .from("vendor_verifications")
      .select(
        "id, vendor_id, status, business_name, legal_name, expires_at, submitted_at, government_id_url, proof_of_address_url, police_clearance_url",
      )
      .eq("id", verificationId)
      .maybeSingle();

    if (rowErr) return json({ error: rowErr.message }, 500);
    if (!row) return json({ error: "Verification not found" }, 404);
    if (row.vendor_id !== userId) return json({ error: "Forbidden" }, 403);

    // Only allow re-verify from states where the employer is expected to act
    const allowed = new Set(["rejected", "info_requested", "expired", "approved", "draft"]);
    if (!allowed.has(row.status)) {
      return json(
        { error: `Cannot re-verify from status "${row.status}". Wait for the current review to complete.` },
        409,
      );
    }

    // Required-document check
    const missing = REQUIRED_DOC_KEYS.filter(
      (k) => !(row as Record<string, unknown>)[k] || typeof (row as Record<string, unknown>)[k] !== "string",
    );
    if (missing.length > 0) {
      return json({ error: "Missing required documents", missing }, 422);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    // Extend expiry: 1 year from submission (verification remains provisional until admin approves,
    // but the expiry cycle resets so reminders/badges reflect the new submission window).
    const newExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: updated, error: upErr } = await admin
      .from("vendor_verifications")
      .update({
        status: "pending",
        business_name: businessName,
        legal_name: legalName,
        submitted_at: nowIso,
        expires_at: newExpiresAt,
        rejection_note: null,
        rejection_reasons: [],
        info_request_note: null,
        info_request_items: [],
      } as never)
      .eq("id", row.id)
      .eq("vendor_id", userId)
      .select("id, status, submitted_at, expires_at")
      .single();

    if (upErr) return json({ error: upErr.message }, 500);

    // Audit entry (best-effort)
    await admin.from("admin_audit_log").insert({
      actor_id: userId,
      target_user_id: userId,
      action: "verification.resubmitted",
      entity_type: "vendor_verification",
      entity_id: row.id,
      details: {
        previous_status: row.status,
        new_status: "pending",
        expires_at: newExpiresAt,
        business_name: businessName,
      },
    } as never);

    // Confirmation notification to employer
    await admin.from("notifications").insert({
      user_id: userId,
      type: "verification_resubmitted",
      title: "Re-verification submitted",
      message:
        "Your updated documents were submitted for review. Verification expiry has been extended to " +
        new Date(newExpiresAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        ".",
      metadata: {
        verification_id: row.id,
        expires_at: newExpiresAt,
        event: "verification.resubmitted",
      },
    } as never);

    // Notify routed admins/moderators (best-effort)
    const { data: admins } = await admin.rpc("moderation_route_recipients", {
      _kind: "verification",
      _tenant: null,
    });
    const adminIds: string[] = Array.isArray(admins) ? (admins as string[]) : [];
    if (adminIds.length > 0) {
      await admin.from("notifications").insert(
        adminIds.map((aid) => ({
          user_id: aid,
          type: "moderation_verification",
          title: "Employer re-verification submitted",
          message: `${businessName} resubmitted verification documents for review.`,
          metadata: {
            kind: "verification",
            entity_id: row.id,
            event: "verification.resubmitted",
            link: "/admin/verifications",
          },
        })) as never,
      );
    }

    return json({
      success: true,
      verification: updated,
      expires_at: newExpiresAt,
      notified_admins: adminIds.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("employer-reverify error", err);
    return json({ error: message }, 500);
  }
});
