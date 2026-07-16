import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_meses",
  title: "List available months",
  description:
    "List the distinct año_mes_num (e.g. 202606 = June 2026) that have financial data available for the signed-in user's companies.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await (sb
      .from("v_meses_disponibles") as any)
      .select("año_mes_num")
      .order("año_mes_num", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const meses = Array.from(new Set((data ?? []).map((r: { año_mes_num: number }) => r.año_mes_num)));
    return {
      content: [{ type: "text", text: JSON.stringify(meses) }],
      structuredContent: { meses },
    };
  },
});