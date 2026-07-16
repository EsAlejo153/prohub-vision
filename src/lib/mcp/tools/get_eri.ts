import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_eri",
  title: "Get Estado de Resultados Integral",
  description:
    "Return the ERI (income statement) rows for a company and month. compania is one of 'IQLICK', 'PROHUB S.A.S.', or 'Todas' (consolidated).",
  inputSchema: {
    compania: z.string().min(1),
    ano_mes_num: z.number().int().describe("Period as YYYYMM integer, e.g. 202606."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ compania, ano_mes_num }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await (sb.from("v_eri_por_mes") as any)
      .select("orden,nivel,seccion,grupo_titulo,concepto,cuenta_key,signo,valor_presentacion,saldo_mes")
      .eq("año_mes_num", ano_mes_num)
      .eq("compania", compania)
      .order("orden", { ascending: true })
      .limit(2000);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});