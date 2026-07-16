// Generates a polished task title + description from a short user prompt
// using the Lovable AI Gateway with tool-calling for structured output.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const rawMode = body?.mode;
    const mode: "generate" | "improve" | "suggest_questions" =
      rawMode === "improve" ? "improve" : rawMode === "suggest_questions" ? "suggest_questions" : "generate";
    const { prompt, category, description, title } = body ?? {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ─── SUGGEST_QUESTIONS: 3 short follow-up questions ─────────────────
    if (mode === "suggest_questions") {
      const desc = typeof description === "string" ? description.trim() : "";
      if (desc.length < 10) {
        return new Response(
          JSON.stringify({ error: "Description must be at least 10 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sysSuggest = `You help homeowners write clearer service-request tasks.
Given a task title (optional), category (optional), and description, propose exactly 3 short follow-up questions a service professional would likely ask to do the job well.
Rules:
  • Each question must be 4–14 words, end with a question mark.
  • Questions must be specific to the task (e.g. "Is it a hot or cold water line?", not "Anything else?").
  • Do NOT repeat info already in the description.
  • No numbering, no quotes, plain English only.`;

      const userSuggest = [
        category ? `Category: ${category}` : null,
        title ? `Title: ${String(title).trim()}` : null,
        `Description:\n${desc}`,
      ].filter(Boolean).join("\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sysSuggest },
            { role: "user", content: userSuggest },
          ],
          tools: [{
            type: "function",
            function: {
              name: "emit_questions",
              description: "Return exactly 3 follow-up questions.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "emit_questions" } },
        }),
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error (suggest):", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) {
        return new Response(JSON.stringify({ error: "AI did not return a structured result." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let parsed: { questions?: string[] };
      try { parsed = JSON.parse(argsStr); } catch {
        return new Response(JSON.stringify({ error: "Could not parse AI response." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const questions = (parsed.questions ?? [])
        .map((q) => String(q).trim())
        .filter((q) => q.length > 0)
        .slice(0, 3);
      if (questions.length === 0) {
        return new Response(JSON.stringify({ error: "AI returned no questions." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── IMPROVE: polish an existing description in place ───────────────
    if (mode === "improve") {
      if (!description || typeof description !== "string" || description.trim().length < 10) {
        return new Response(
          JSON.stringify({ error: "Description must be at least 10 characters to improve." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const improveSystem = `You polish task descriptions for a home-services marketplace.
Rewrite the user's description to be clearer, more professional, and easier for a service professional to act on.
Rules:
  • Keep it 120–500 characters.
  • Stay strictly factual — never invent details, locations, dates, or specifics the user didn't mention.
  • Do not add a title, headings, bullet points, or quotes.
  • Plain English only. Output the rewritten description text only.`;

      const improveUser = category
        ? `Service category: ${category}\n\nOriginal description:\n${description.trim()}`
        : `Original description:\n${description.trim()}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: improveSystem },
            { role: "user", content: improveUser },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_description",
                description: "Return the polished description text only.",
                parameters: {
                  type: "object",
                  properties: {
                    description: { type: "string", description: "Polished description, 120–500 chars." },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "emit_description" } },
        }),
      });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error (improve):", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) {
        console.error("No tool call returned (improve):", JSON.stringify(data));
        return new Response(JSON.stringify({ error: "AI did not return a structured result." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let parsed: { description?: string };
      try { parsed = JSON.parse(argsStr); } catch {
        return new Response(JSON.stringify({ error: "Could not parse AI response." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const polished = (parsed.description ?? "").trim().slice(0, 1000);
      if (!polished) {
        return new Response(JSON.stringify({ error: "AI returned an empty result." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ description: polished }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GENERATE: turn a short prompt into title + description ─────────
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Prompt must be at least 3 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You help homeowners post service-request tasks on a marketplace.
Turn a short, possibly messy prompt into a polished task post.

OUTPUT FORMAT — follow EXACTLY, no preamble, no markdown, no quotes:
TITLE: <concise action-oriented title, max 80 chars, no trailing punctuation>
DESCRIPTION: <clear professional description, 120–500 chars, listing what's wrong, where, and any helpful context a pro would need>

Stay strictly factual — never invent specifics the user didn't mention. Plain English only.
Output nothing before "TITLE:" and nothing after the description.`;

    const userPrompt = category
      ? `Service category: ${category}\n\nUser's short prompt:\n${prompt.trim()}`
      : `User's short prompt:\n${prompt.trim()}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok || !response.body) {
      const t = response.body ? await response.text() : "";
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pass the gateway SSE stream straight through to the client.
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-task-description error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
