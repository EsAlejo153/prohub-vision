import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { FiltroDashboard, KpisPeriodo } from "@/types/financiero";
import { buildPeriodoRange } from "@/context/FiltrosContext";

const SUM_FIELDS: (keyof KpisPeriodo)[] = [
  "ingresos",
  "costos",
  "gastos_adm",
  "gastos_oper",
  "gastos_fin",
  "utilidad_bruta",
  "utilidad_operacional",
  "utilidad_neta",
  "activos_totales",
  "pasivos_totales",
  "patrimonio_total",
];

const AVG_FIELDS: (keyof KpisPeriodo)[] = [
  "margen_bruto_pct",
  "margen_operacional_pct",
  "margen_neto_pct",
  "costo_ingreso_pct",
  "gastos_ingreso_pct",
  "endeudamiento_pct",
  "autonomia_pct",
  "apalancamiento",
  "roe_pct",
  "roa_pct",
];

export interface KpisAgregados {
  ingresos: number;
  costos: number;
  gastos_adm: number;
  gastos_oper: number;
  gastos_fin: number;
  utilidad_bruta: number;
  utilidad_operacional: number;
  utilidad_neta: number;
  activos_totales: number;
  pasivos_totales: number;
  patrimonio_total: number;
  margen_bruto_pct: number;
  margen_operacional_pct: number;
  margen_neto_pct: number;
  costo_ingreso_pct: number;
  gastos_ingreso_pct: number;
  endeudamiento_pct: number;
  autonomia_pct: number;
  apalancamiento: number;
  roe_pct: number;
  roa_pct: number;
  rowCount: number;
}

export function useKpis(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["kpis", filtros],
    queryFn: async (): Promise<KpisAgregados | null> => {
      let q = supabase.from("v_kpis_periodo").select("*");

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "Todas") q = q.eq("cc_key", filtros.ccKey);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as KpisPeriodo[];
      if (rows.length === 0) return null;

      const agg: Record<string, number> = {};
      for (const f of SUM_FIELDS) {
        agg[f as string] = rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
      }
      for (const f of AVG_FIELDS) {
        const vals = rows.map((r) => Number(r[f])).filter((n) => Number.isFinite(n));
        agg[f as string] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }
      return { ...(agg as Omit<KpisAgregados, "rowCount">), rowCount: rows.length };
    },
  });
}
