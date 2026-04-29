import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { FiltroDashboard, TendenciaMensual } from "@/types/financiero";
import { buildPeriodoRange } from "@/context/FiltrosContext";

export function useTendencia(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["tendencia", filtros],
    queryFn: async (): Promise<TendenciaMensual[]> => {
      let q = supabase
        .from("v_tendencia_mensual")
        .select("*")
        .order("año_mes_num", { ascending: true });

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "Todas") q = q.eq("cc_key", filtros.ccKey);

      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<number, TendenciaMensual>();
      for (const r of (data ?? []) as TendenciaMensual[]) {
        const existing = map.get(r.año_mes_num);
        if (!existing) {
          map.set(r.año_mes_num, { ...r });
        } else {
          existing.ingresos += Number(r.ingresos) || 0;
          existing.utilidad_operacional += Number(r.utilidad_operacional) || 0;
          existing.utilidad_neta += Number(r.utilidad_neta) || 0;
          existing.margen_operacional_pct =
            (existing.margen_operacional_pct + Number(r.margen_operacional_pct)) / 2;
          existing.margen_neto_pct = (existing.margen_neto_pct + Number(r.margen_neto_pct)) / 2;
        }
      }
      return Array.from(map.values()).sort((a, b) => a.año_mes_num - b.año_mes_num);
    },
  });
}
