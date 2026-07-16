import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_esf",
  title: "Get Estado de Situación Financiera",
  description:
    "Return the ESF (balance sheet) rows for a company and month. Use list_meses first to discover available año_mes_num. compania is one of 'IQLICK', 'PROHUB S.A.S.', or 'Todas' (consolidated).",
  inputSchema: {
    compania: z.string().min(1).describe("Company name, e.g. 'PROHUB S.A.S.' or 'Todas' for consolidated."),
    ano_mes_num: z
      .number()
      .int()
      .describe("Period as YYYYMM integer, e.g. 202606 for June 2026."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ compania, ano_mes_num }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await (sb.from("v_esf_resumida") as any)
      .select("orden,nivel,seccion,grupo_titulo,concepto,cuenta_key,signo,valor_presentacion,saldo_acum")
      .eq("año_mes_num", ano_mes_num)
      .eq("compania", compania)
      .neq("nivel", "CuentaERI")
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