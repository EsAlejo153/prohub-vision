import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { FiltroDashboard } from "@/types/financiero";
import { buildPeriodoRange } from "@/context/FiltrosContext";

export interface KpiMesRow {
  compania: string;
  cc_key?: string;
  año_mes_num: number;
  mes_label: string;
  ingresos: number;
  costos: number;
  gastos_adm: number;
  gastos_oper: number;
  gastos_fin: number;
  utilidad_bruta: number;
  utilidad_operacional: number;
  utilidad_neta: number;
  margen_bruto_pct: number;
  margen_operacional_pct: number;
  margen_neto_pct: number;
  costo_ingreso_pct: number;
  endeudamiento_pct: number;
  autonomia_pct: number;
  roe_pct: number;
  roa_pct: number;
  activos_totales: number;
  pasivos_totales: number;
  patrimonio_total: number;
  delta_ingresos_pct: number | null;
  delta_util_oper_pct: number | null;
  delta_util_neta_pct: number | null;
}

export interface DistribucionGastosRow {
  compania: string;
  año_mes_num: number;
  pct_adm: number;
  pct_oper: number;
  pct_fin: number;
  pct_costos: number;
}

export interface TopCuentaRow {
  compania: string;
  año_mes_num: number;
  ranking: number;
  cuenta_key?: string;
  cuenta_codigo?: string;
  nombre_cuenta?: string;
  cuenta_nombre?: string;
  total?: number;
  valor?: number;
  participacion_pct?: number;
}

export interface BalanceTotals {
  activos: number;
  pasivos: number;
  patrimonio: number;
}

export function useKpisMesAMes(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["kpis_mes_a_mes", filtros],
    queryFn: async (): Promise<KpiMesRow[]> => {
      let q = supabase.from("v_kpis_mes_a_mes").select("*").order("año_mes_num", { ascending: true });

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);

      // "Todas" → usar fila GRUPO consolidada de la vista
      if (filtros.compania === "Todas") {
        q = q.eq("compania", "GRUPO");
      } else {
        q = q.eq("compania", filtros.compania);
      }

      const { data, error } = await q;
      if (error) throw error;

      const arr = ((data ?? []) as KpiMesRow[]).sort((a, b) => a.año_mes_num - b.año_mes_num);

      // Recalcular deltas mes a mes en el frontend
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i];
        const prev = i > 0 ? arr[i - 1] : null;
        cur.delta_ingresos_pct =
          prev && prev.ingresos ? ((cur.ingresos - prev.ingresos) / Math.abs(prev.ingresos)) * 100 : null;
        cur.delta_util_oper_pct =
          prev && prev.utilidad_operacional
            ? ((cur.utilidad_operacional - prev.utilidad_operacional) / Math.abs(prev.utilidad_operacional)) * 100
            : null;
        cur.delta_util_neta_pct =
          prev && prev.utilidad_neta
            ? ((cur.utilidad_neta - prev.utilidad_neta) / Math.abs(prev.utilidad_neta)) * 100
            : null;
      }

      return arr;
    },
  });
}

export function useDistribucionGastos(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["distribucion_gastos", filtros],
    queryFn: async (): Promise<DistribucionGastosRow[]> => {
      let q = supabase.from("v_distribucion_gastos").select("*").order("año_mes_num", { ascending: true });

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);

      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);

      const { data, error } = await q;
      if (error) throw error;

      if (filtros.compania === "Todas") {
        const mesMap = new Map<number, { adm: number; oper: number; fin: number; costos: number }>();
        const hasAbsolutes = (data ?? []).some((r: any) => r.total_adm != null);

        if (!hasAbsolutes) return (data ?? []) as DistribucionGastosRow[];

        for (const r of (data ?? []) as any[]) {
          const mes = r.año_mes_num;
          const ex = mesMap.get(mes);
          if (ex) {
            ex.adm += r.total_adm || 0;
            ex.oper += r.total_oper || 0;
            ex.fin += r.total_fin || 0;
            ex.costos += r.total_costos || 0;
          } else {
            mesMap.set(mes, {
              adm: r.total_adm || 0,
              oper: r.total_oper || 0,
              fin: r.total_fin || 0,
              costos: r.total_costos || 0,
            });
          }
        }

        return Array.from(mesMap.entries()).map(([mes, v]) => {
          const total = v.adm + v.oper + v.fin + v.costos || 1;
          return {
            compania: "GRUPO",
            año_mes_num: mes,
            pct_adm: (v.adm / total) * 100,
            pct_oper: (v.oper / total) * 100,
            pct_fin: (v.fin / total) * 100,
            pct_costos: (v.costos / total) * 100,
          };
        });
      }

      return (data ?? []) as DistribucionGastosRow[];
    },
  });
}

export function useTopCuentas(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["top_cuentas", filtros],
    queryFn: async (): Promise<TopCuentaRow[]> => {
      let q = supabase.from("v_top_cuentas_ingreso").select("*").order("ranking", { ascending: true });

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);

      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TopCuentaRow[];
    },
  });
}

export function useBalanceFallback(filtros: FiltroDashboard, enabled: boolean) {
  return useQuery({
    queryKey: ["balance_fallback", filtros],
    enabled,
    queryFn: async (): Promise<BalanceTotals> => {
      // Paso 1: obtener el último mes disponible dentro del rango de filtros
      let qMes = supabase.from("movimientos").select("año_mes_num").order("año_mes_num", { ascending: false }).limit(1);

      if (filtros.compania !== "Todas") qMes = qMes.eq("compania", filtros.compania);

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) qMes = qMes.lte("año_mes_num", range.max).gte("año_mes_num", range.min);

      const { data: mesData } = await qMes;
      const ultimoMes = (mesData?.[0] as any)?.año_mes_num;
      if (!ultimoMes) return { activos: 0, pasivos: 0, patrimonio: 0 };

      // Paso 2: traer saldos SOLO del último mes (saldo_final es stock, no se suma)
      let q = supabase.from("movimientos").select("clase_cod, saldo_final").eq("año_mes_num", ultimoMes);

      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as { clase_cod: string | null; saldo_final: number | null }[];
      const sumOf = (cls: string) =>
        rows.filter((r) => String(r.clase_cod).trim() === cls).reduce((s, r) => s + (Number(r.saldo_final) || 0), 0);

      const activos = sumOf("1");
      const pasivos = sumOf("2");
      const patrimonio3 = sumOf("3");
      const patrimonio = patrimonio3 !== 0 ? patrimonio3 : activos - pasivos;

      return { activos, pasivos, patrimonio };
    },
  });
}
