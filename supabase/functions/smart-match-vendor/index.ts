import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Location scoring helpers ─────────────────────────────────────────────
   Tokenises both addresses, drops street-type/stop words, and grants:
   - 1.00 for matching ZIP
   - 0.50 for matching US state (full name OR 2-letter code)
   - 0.50 for matching city/locality token (any non-state, non-stop token of len ≥ 3)
   - 0.30 partial credit for substring match on tokens of len > 4
   Scores from each bucket are summed and capped at 1.0.
───────────────────────────────────────────────────────────────────────────── */
const STOP_WORDS = new Set([
  "st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard",
  "ln", "lane", "dr", "drive", "ct", "court", "pl", "place", "way", "hwy",
  "highway", "pkwy", "parkway", "ter", "terrace", "n", "s", "e", "w", "ne",
  "nw", "se", "sw", "north", "south", "east", "west", "apt", "suite", "ste",
  "unit", "po", "box", "the", "of", "and", "usa", "us",
]);
const US_STATES: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi",
  mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire",
  nj: "new jersey", nm: "new mexico", ny: "new york", nc: "north carolina",
  nd: "north dakota", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania",
  ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee",
  tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington",
  wv: "west virginia", wi: "wisconsin", wy: "wyoming", dc: "district of columbia",
};
const STATE_NAMES = new Set(Object.values(US_STATES).flatMap((n) => n.split(" ")));
const STATE_CODES = new Set(Object.keys(US_STATES));

function tokenize(addr: string): string[] {
  return addr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function extractParts(addr: string) {
  const tokens = tokenize(addr);
  const zips = new Set<string>();
  const states = new Set<string>();
  const cityTokens = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d{5}$/.test(t)) { zips.add(t); continue; }
    if (/^\d+$/.test(t)) continue; // street numbers
    if (STATE_CODES.has(t)) { states.add(t); continue; }
    if (STATE_NAMES.has(t)) {
      // try to match full state name (e.g., "new york")
      const next = tokens[i + 1];
      const combined = next ? `${t} ${next}` : t;
      const matchedFull = Object.entries(US_STATES).find(([, n]) => n === combined || n === t);
      if (matchedFull) { states.add(matchedFull[0]); if (combined === matchedFull[1]) i++; continue; }
    }
    if (STOP_WORDS.has(t)) continue;
    if (t.length >= 3) cityTokens.add(t);
  }
  return { zips, states, cityTokens };
}

function computeLocationScore(custAddr: string, vendAddr: string): number {
  const cust = extractParts(custAddr);
  const vend = extractParts(vendAddr);

  let score = 0;

  // ZIP exact match → strongest signal
  for (const z of cust.zips) if (vend.zips.has(z)) { score += 1.0; break; }

  // State match
  for (const s of cust.states) if (vend.states.has(s)) { score += 0.5; break; }

  // City/locality token match
  let cityHit = false;
  for (const c of cust.cityTokens) {
    if (vend.cityTokens.has(c)) { score += 0.5; cityHit = true; break; }
  }

  // Partial substring fallback (e.g., "brooklyn" ↔ "brooklynheights")
  if (!cityHit) {
    for (const c of cust.cityTokens) {
      if (c.length <= 4) continue;
      for (const v of vend.cityTokens) {
        if (v.includes(c) || c.includes(v)) { score += 0.3; cityHit = true; break; }
      }
      if (cityHit) break;
    }
  }

  return Math.min(score, 1);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { categoryId, customerAddress, budgetMin, budgetMax } = await req.json();
    if (!categoryId) {
      return new Response(JSON.stringify({ error: "categoryId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: services, error: svcErr } = await supabase
      .from("vendor_services")
      .select("id, vendor_id, title, description, price_min, price_max, price_type")
      .eq("category_id", categoryId)
      .eq("is_active", true);

    if (svcErr) throw svcErr;
    if (!services || services.length === 0) {
      return new Response(JSON.stringify({ recommendation: null, vendors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vendorIds = [...new Set(services.map((s: any) => s.vendor_id))];

    const todayDow = new Date().getDay();
    const next7Days = Array.from({ length: 7 }, (_, i) => (todayDow + i) % 7);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, reviewsRes, availabilityRes, recentBookingsRes, blockedDatesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, address, bio, avatar_url").in("user_id", vendorIds),
      supabase.from("reviews").select("vendor_id, rating, created_at").in("vendor_id", vendorIds),
      supabase.from("vendor_availability").select("vendor_id, day_of_week, start_time, end_time").in("vendor_id", vendorIds).eq("is_available", true).in("day_of_week", next7Days),
      supabase.from("bookings").select("vendor_id, status, created_at").in("vendor_id", vendorIds).gte("created_at", thirtyDaysAgo),
      supabase.from("vendor_blocked_dates").select("vendor_id, blocked_date").in("vendor_id", vendorIds),
    ]);

    const profiles = profilesRes.data || [];
    const reviews = reviewsRes.data || [];
    const availability = availabilityRes.data || [];
    const recentBookings = recentBookingsRes.data || [];
    const blockedDates = blockedDatesRes.data || [];

    const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

    const reviewMap: Record<string, { total: number; count: number; recentCount: number }> = {};
    for (const r of reviews) {
      if (!reviewMap[r.vendor_id]) reviewMap[r.vendor_id] = { total: 0, count: 0, recentCount: 0 };
      reviewMap[r.vendor_id].total += r.rating;
      reviewMap[r.vendor_id].count += 1;
      if (r.created_at >= sevenDaysAgo) reviewMap[r.vendor_id].recentCount += 1;
    }

    const availMap: Record<string, number> = {};
    const blockedSet = new Set(blockedDates.map((d) => `${d.vendor_id}_${d.blocked_date}`));
    for (const a of availability) {
      const today = new Date();
      for (let offset = 0; offset < 7; offset++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + offset);
        if (checkDate.getDay() !== a.day_of_week) continue;
        const dateStr = checkDate.toISOString().split("T")[0];
        if (blockedSet.has(`${a.vendor_id}_${dateStr}`)) continue;
        const [startH] = a.start_time.split(":").map(Number);
        const [endH] = a.end_time.split(":").map(Number);
        const slots = Math.max(0, endH - startH);
        availMap[a.vendor_id] = (availMap[a.vendor_id] || 0) + slots;
      }
    }

    const bookingCountMap: Record<string, number> = {};
    const completionRateMap: Record<string, { total: number; completed: number }> = {};
    const responseSpeedMap: Record<string, { acceptedCount: number }> = {};
    for (const b of recentBookings) {
      bookingCountMap[b.vendor_id] = (bookingCountMap[b.vendor_id] || 0) + 1;
      if (!completionRateMap[b.vendor_id]) completionRateMap[b.vendor_id] = { total: 0, completed: 0 };
      completionRateMap[b.vendor_id].total += 1;
      if (b.status === "completed") completionRateMap[b.vendor_id].completed += 1;
      if (!responseSpeedMap[b.vendor_id]) responseSpeedMap[b.vendor_id] = { acceptedCount: 0 };
      if (b.status === "accepted" || b.status === "completed") {
        responseSpeedMap[b.vendor_id].acceptedCount += 1;
      }
    }

    const scored = vendorIds.map((vid) => {
      const profile = profileMap[vid] || {};
      const rv = reviewMap[vid] || { total: 0, count: 0, recentCount: 0 };
      const avgRating = rv.count > 0 ? rv.total / rv.count : 0;
      const availSlots = availMap[vid] || 0;
      const bookings30d = bookingCountMap[vid] || 0;
      const completion = completionRateMap[vid];
      const completionRate = completion && completion.total > 0 ? completion.completed / completion.total : 0;
      const vendorServices = services.filter((s: any) => s.vendor_id === vid);

      const speed = responseSpeedMap[vid];
      const responseRate = speed && bookings30d > 0 ? speed.acceptedCount / bookings30d : 0;

      let budgetFitScore = 0;
      if (budgetMin != null || budgetMax != null) {
        const custMin = budgetMin ?? 0;
        const custMax = budgetMax && budgetMax > 0 ? budgetMax : Infinity;
        let fittingServices = 0;
        for (const s of vendorServices) {
          const sMin = s.price_min ?? 0;
          const sMax = s.price_max ?? sMin;
          if (sMin <= custMax && sMax >= custMin) fittingServices++;
        }
        budgetFitScore = vendorServices.length > 0 ? fittingServices / vendorServices.length : 0;
      } else {
        budgetFitScore = 0.5;
      }

      let locationScore = 0;
      if (customerAddress && profile.address) {
        locationScore = computeLocationScore(customerAddress, profile.address);
      }

      const recencyBonus = rv.recentCount > 0 ? 0.15 : 0;

      const ratingScore = (avgRating / 5) * 28;
      const availScore = Math.min(availSlots / 20, 1) * 16;
      const locScore = locationScore * 14;
      const popularityScore = Math.min(bookings30d / 10, 1) * 10;
      const completionScoreVal = completionRate * 8;
      const recencyScore = recencyBonus * 6;
      const budgetScoreVal = budgetFitScore * 10;
      const responseScoreVal = responseRate * 8;

      const totalScore = ratingScore + availScore + locScore + popularityScore + completionScoreVal + recencyScore + budgetScoreVal + responseScoreVal;

      const dimensions = {
        skill_match: Math.round(((avgRating / 5) * 0.7 + (rv.count > 0 ? Math.min(rv.count / 20, 1) * 0.3 : 0)) * 100),
        rating: Math.round((avgRating / 5) * 100),
        distance: Math.round(locationScore * 100),
        availability: Math.round(Math.min(availSlots / 20, 1) * 100),
        budget_fit: Math.round(budgetFitScore * 100),
        response_speed: Math.round(responseRate * 100),
      };

      return {
        vendor_id: vid,
        display_name: profile.display_name || "Provider",
        address: profile.address,
        bio: profile.bio,
        avatar_url: profile.avatar_url || null,
        avg_rating: Math.round(avgRating * 10) / 10,
        review_count: rv.count,
        available_slots: availSlots,
        bookings_30d: bookings30d,
        completion_rate: Math.round(completionRate * 100),
        response_rate: Math.round(responseRate * 100),
        score: Math.round(totalScore),
        dimensions,
        services: vendorServices,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let recommendation = "";

    if (LOVABLE_API_KEY && scored.length > 0) {
      const top3 = scored.slice(0, 3);
      const prompt = `You are a smart booking assistant for a home services platform. A customer is looking for a service provider. Based on the following ranked vendors, write a brief, friendly 2-3 sentence recommendation explaining why the top vendor is the best match. Be specific about their strengths — mention real numbers.

Ranked vendors:
${top3
  .map(
    (v, i) =>
      `${i + 1}. ${v.display_name} — Rating: ${v.avg_rating}/5 (${v.review_count} reviews), ${v.available_slots} time slots available this week, ${v.bookings_30d} bookings in last 30 days, ${v.completion_rate}% completion rate, ${v.response_rate}% response rate${v.address ? `, located at ${v.address}` : ""}, services: ${v.services.map((s: any) => s.title).join(", ")}`
  )
  .join("\n")}

${customerAddress ? `Customer location: ${customerAddress}` : ""}
${budgetMin != null ? `Customer budget: $${budgetMin}${budgetMax ? ` – $${budgetMax}` : "+"}` : ""}

Write a concise recommendation (max 3 sentences). Don't use bullet points. Be warm, specific, and helpful.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a concise, warm booking assistant for a home services marketplace. Keep responses under 3 sentences. Be specific with numbers and details." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          recommendation = aiData.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (e) {
        console.error("AI recommendation error:", e);
      }
    }

    if (!recommendation && scored.length > 0) {
      const top = scored[0];
      const parts = [`We recommend ${top.display_name}`];
      if (top.avg_rating > 0) parts.push(`with a ${top.avg_rating}★ rating from ${top.review_count} reviews`);
      if (top.available_slots > 0) parts.push(`and ${top.available_slots} slots open this week`);
      if (top.completion_rate > 0) parts.push(`(${top.completion_rate}% completion rate)`);
      recommendation = parts.join(" ") + ".";
    }

    return new Response(
      JSON.stringify({ recommendation, vendors: scored }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-match error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
