// Generate a downloadable PDF receipt for a booking and return a signed URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtMoney = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return d;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const bookingId = body?.bookingId as string | undefined;
    if (!bookingId || typeof bookingId !== "string") {
      return json({ error: "bookingId is required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load booking
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select(
        "id, customer_id, vendor_id, service_id, booking_date, start_time, end_time, status, payment_status, payment_method, total_price, subtotal, tax_amount, tax_rate, discount_amount, coupon_code, notes, created_at",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    // Authorize: customer, vendor, or admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles || []).some((r) => r.role === "admin");
    const isCustomer = booking.customer_id === user.id;
    const isVendor = booking.vendor_id === user.id;
    if (!isAdmin && !isCustomer && !isVendor) {
      return json({ error: "Forbidden" }, 403);
    }

    // Fetch related data
    const [{ data: customer }, { data: vendor }, { data: service }, { data: settings }] =
      await Promise.all([
        admin.from("profiles").select("display_name, phone, address").eq("user_id", booking.customer_id).maybeSingle(),
        admin.from("profiles").select("display_name, phone, address").eq("user_id", booking.vendor_id).maybeSingle(),
        admin.from("vendor_services").select("title, description").eq("id", booking.service_id).maybeSingle(),
        admin.from("platform_settings").select("value").eq("key", "platform_commission_rate").maybeSingle(),
      ]);

    const commissionRate = (() => {
      const v = settings?.value ? Number(settings.value) : NaN;
      return Number.isFinite(v) && v >= 0 ? v : 10;
    })();

    const total = Number(booking.total_price ?? 0);
    const subtotal = Number(booking.subtotal ?? total);
    const tax = Number(booking.tax_amount ?? 0);
    const discount = Number(booking.discount_amount ?? 0);
    const commission = Math.max(0, total) * (commissionRate / 100);
    const vendorPayout = Math.max(0, total - commission);

    // Build PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const teal = rgb(0, 0.153, 0.173); // #00272c
    const muted = rgb(0.4, 0.4, 0.4);
    const black = rgb(0.05, 0.05, 0.05);
    const line = rgb(0.85, 0.84, 0.82);

    let y = 750;
    const left = 48;
    const right = 564;

    // Header
    page.drawText("Booking Receipt", { x: left, y, size: 22, font: bold, color: teal });
    page.drawText(`Receipt #${booking.id.slice(0, 8).toUpperCase()}`, {
      x: right - font.widthOfTextAtSize(`Receipt #${booking.id.slice(0, 8).toUpperCase()}`, 10),
      y: y + 6,
      size: 10,
      font,
      color: muted,
    });
    page.drawText(`Issued ${fmtDate(new Date().toISOString())}`, {
      x: right - font.widthOfTextAtSize(`Issued ${fmtDate(new Date().toISOString())}`, 10),
      y: y - 8,
      size: 10,
      font,
      color: muted,
    });
    y -= 28;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
    y -= 24;

    // Parties
    const drawLabel = (label: string, value: string, x: number, yy: number, width = 240) => {
      page.drawText(label.toUpperCase(), { x, y: yy, size: 8, font: bold, color: muted });
      const lines = wrap(value || "—", font, 10, width);
      let ly = yy - 12;
      for (const ln of lines.slice(0, 3)) {
        page.drawText(ln, { x, y: ly, size: 10, font, color: black });
        ly -= 12;
      }
      return ly;
    };

    drawLabel("Customer", customer?.display_name || "—", left, y);
    drawLabel("Provider", vendor?.display_name || "—", left + 280, y);
    y -= 56;

    // Booking details box
    page.drawRectangle({
      x: left, y: y - 88, width: right - left, height: 88,
      color: rgb(0.97, 0.98, 0.97), borderColor: line, borderWidth: 1,
    });
    const dx1 = left + 16, dx2 = left + 200, dx3 = left + 380;
    const dy = y - 18;
    page.drawText("SERVICE", { x: dx1, y: dy, size: 8, font: bold, color: muted });
    page.drawText(service?.title || "Service", { x: dx1, y: dy - 14, size: 11, font: bold, color: teal });
    page.drawText("DATE", { x: dx2, y: dy, size: 8, font: bold, color: muted });
    page.drawText(fmtDate(booking.booking_date), { x: dx2, y: dy - 14, size: 11, font, color: black });
    page.drawText("TIME", { x: dx3, y: dy, size: 8, font: bold, color: muted });
    page.drawText(`${(booking.start_time || "").slice(0, 5)} – ${(booking.end_time || "").slice(0, 5)}`,
      { x: dx3, y: dy - 14, size: 11, font, color: black });

    page.drawText("STATUS", { x: dx1, y: dy - 40, size: 8, font: bold, color: muted });
    page.drawText(String(booking.status || "—").toUpperCase(), { x: dx1, y: dy - 54, size: 11, font: bold, color: teal });
    page.drawText("PAYMENT", { x: dx2, y: dy - 40, size: 8, font: bold, color: muted });
    page.drawText(String(booking.payment_status || "—").toUpperCase(), { x: dx2, y: dy - 54, size: 11, font: bold, color: paymentColor(booking.payment_status, teal) });
    page.drawText("METHOD", { x: dx3, y: dy - 40, size: 8, font: bold, color: muted });
    page.drawText(String(booking.payment_method || "—").toUpperCase(), { x: dx3, y: dy - 54, size: 11, font, color: black });

    y -= 108;

    // Line items table
    page.drawText("Charges", { x: left, y, size: 13, font: bold, color: teal });
    y -= 14;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
    y -= 16;

    const row = (label: string, amount: number, opts: { bold?: boolean; muted?: boolean; negative?: boolean } = {}) => {
      const f = opts.bold ? bold : font;
      const c = opts.muted ? muted : black;
      page.drawText(label, { x: left, y, size: 10, font: f, color: c });
      const amt = `${opts.negative ? "−" : ""}${fmtMoney(Math.abs(amount))}`;
      page.drawText(amt, {
        x: right - f.widthOfTextAtSize(amt, 10),
        y, size: 10, font: f, color: c,
      });
      y -= 16;
    };

    row("Subtotal", subtotal);
    if (discount > 0) row(`Discount${booking.coupon_code ? ` (${booking.coupon_code})` : ""}`, discount, { negative: true, muted: true });
    if (tax > 0) row(`Tax${booking.tax_rate ? ` (${Number(booking.tax_rate).toFixed(2)}%)` : ""}`, tax);
    y -= 4;
    page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.5, color: line });
    row("Total charged", total, { bold: true });

    y -= 14;

    // Commission breakdown (visible to vendor & admin only — but include for customer too for transparency)
    page.drawText("Commission breakdown", { x: left, y, size: 13, font: bold, color: teal });
    y -= 14;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
    y -= 16;

    row(`Platform commission (${commissionRate}%)`, commission, { negative: true, muted: true });
    row("Provider payout", vendorPayout, { bold: true });

    y -= 16;

    // Notes
    if (booking.notes) {
      page.drawText("Notes", { x: left, y, size: 11, font: bold, color: teal });
      y -= 14;
      const wrapped = wrap(booking.notes, font, 10, right - left);
      for (const ln of wrapped.slice(0, 6)) {
        page.drawText(ln, { x: left, y, size: 10, font, color: black });
        y -= 12;
      }
    }

    // Footer
    page.drawLine({ start: { x: left, y: 70 }, end: { x: right, y: 70 }, thickness: 0.5, color: line });
    const footer = "This is an automatically generated receipt. Keep it for your records.";
    page.drawText(footer, { x: left, y: 56, size: 9, font, color: muted });
    page.drawText(`Booking ID: ${booking.id}`, { x: left, y: 42, size: 8, font, color: muted });

    const bytes = await pdf.save();

    const path = `${booking.id}.pdf`;
    const { error: upErr } = await admin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("upload failed", upErr);
      return json({ error: "Upload failed" }, 500);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("receipts")
      .createSignedUrl(path, 60 * 10); // 10 minutes
    if (signErr || !signed) {
      console.error("signed url failed", signErr);
      return json({ error: "Could not create signed URL" }, 500);
    }

    return json({ url: signed.signedUrl, path });
  } catch (err) {
    console.error("generate-booking-receipt error", err);
    return json({ error: "Internal error" }, 500);
  }
});

function paymentColor(status: string | null | undefined, teal: ReturnType<typeof rgb>) {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "captured" || s === "succeeded") return rgb(0.13, 0.55, 0.27); // green
  if (s === "deposit_paid" || s === "partial") return rgb(0.85, 0.55, 0.05); // amber
  if (s === "refunded") return rgb(0.5, 0.2, 0.6); // purple
  if (s === "unpaid" || s === "failed") return rgb(0.75, 0.18, 0.18); // red
  return teal;
}

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = String(text).replace(/\r/g, "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
