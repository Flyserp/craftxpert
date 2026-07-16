import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function anonClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "search_providers",
  title: "Search providers",
  description:
    "Search public vendor services by keyword. Returns id, title, description, and price range.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Search keyword"),
    limit: z.number().int().min(1).max(20).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, _ctx: ToolContext) => {
    // Escape PostgREST `.or()` reserved characters to prevent filter injection/parse errors.
    const safe = query.replace(/[,()*\\]/g, " ").trim();
    const { data, error } = await anonClient()
      .from("vendor_services")
      .select("id,title,description,price_min,price_max,price_type,is_featured")
      .eq("is_active", true)
      .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { results: data ?? [] },
    };
  },
});