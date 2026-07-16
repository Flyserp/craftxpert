// Send a transactional booking email by hydrating a saved email_templates row.
// Looks up the template by `templateKey`, substitutes {{variable}} placeholders
// from the request `variables` map, and logs the rendered send to
// admin_audit_log so we have an auditable trail. Plug in a real provider
// (Lovable Emails, Resend, etc.) inside the `deliver` helper when ready.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  templateKey: string;
  recipientUserId: string;
  variables: Record<string, string | number | null | undefined>;
}

function isPayload(x: unknown): x is Payload {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.templateKey === "string" &&
    typeof p.recipientUserId === "string" &&
    typeof p.variables === "object" &&
    p.variables !== null
  );
}

function substitute(input: string, vars: Record<string, unknown>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

async function deliver(_to: string, _subject: string, _html: string) {
  // No real provider configured — placeholder for future Lovable Emails / Resend wiring.
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    if (!isPayload(body)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch the saved template.
    const { data: tpl, error: tplErr } = await admin
      .from("email_templates")
      .select("key, name, subject, body_html, is_active")
      .eq("key", body.templateKey)
      .maybeSingle();

    if (tplErr || !tpl) {
      return new Response(
        JSON.stringify({ error: "Template not found", key: body.templateKey }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!tpl.is_active) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Template inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the recipient's email via auth.admin.
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(
      body.recipientUserId,
    );
    if (userErr || !userRes?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Recipient email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const recipientEmail = userRes.user.email;

    // Render placeholders.
    const renderedSubject = substitute(tpl.subject, body.variables);
    const renderedHtml = substitute(tpl.body_html, body.variables);

    await deliver(recipientEmail, renderedSubject, renderedHtml);

    // Audit trail (single source of truth for "did we send it?").
    await admin.from("admin_audit_log").insert({
      actor_id: callerId,
      action: "email.sent",
      entity_type: "email_template",
      entity_id: tpl.key,
      target_user_id: body.recipientUserId,
      details: {
        template_key: tpl.key,
        recipient_email: recipientEmail,
        subject: renderedSubject,
        variables: body.variables,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        templateKey: tpl.key,
        recipient: recipientEmail,
        subject: renderedSubject,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
