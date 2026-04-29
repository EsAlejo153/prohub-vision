import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { FiltroDashboard } from "@/types/financiero";
import { buildPeriodoRange } from "@/context/FiltrosContext";

export interface PlanPygRow {
  orden: number;
  concepto: string;
  nivel: string;
  grupo_titulo: string;
  etiqueta_fila: string;
}

export interface EriValueRow {
  orden: number;
  concepto: string;
  nivel: string;
  grupo_titulo: string;
  etiqueta_fila: string;
  año_mes_num: number;
  compania: string;
  cc_key: string;
  valor_pyg: number;
}

export function usePlanPyg() {
  return useQuery({
    queryKey: ["plan_pyg"],
    queryFn: async (): Promise<PlanPygRow[]> => {
      const { data, error } = await supabase
        .from("plan_pyg")
        .select("orden, concepto, nivel, grupo_titulo, etiqueta_fila")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanPygRow[];
    },
  });
}

export function useEri(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["eri", filtros],
    queryFn: async (): Promise<EriValueRow[]> => {
      let q = supabase.from("v_eri_por_mes").select("*");
      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "Todas") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EriValueRow[];
    },
  });
}
