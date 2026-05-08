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

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function buildLabel(yyyymm: number) {
  const m = yyyymm % 100;
  return MES_LABELS[m - 1] ?? String(m);
}

// Recalcula porcentajes desde los valores absolutos ya consolidados
function recomputePcts(r: KpiMesRow): KpiMesRow {
  const ing = r.ingresos || 1;
  const act = r.activos_totales || 1;
  const pat = r.patrimonio_total || 1;
  return {
    ...r,
    margen_bruto_pct: r.ingresos !== 0 ? (r.utilidad_bruta / ing) * 100 : 0,
    margen_operacional_pct: r.ingresos !== 0 ? (r.utilidad_operacional / ing) * 100 : 0,
    margen_neto_pct: r.ingresos !== 0 ? (r.utilidad_neta / ing) * 100 : 0,
    costo_ingreso_pct: r.ingresos !== 0 ? (r.costos / ing) * 100 : 0,
    endeudamiento_pct: r.activos_totales !== 0 ? (Math.abs(r.pasivos_totales) / Math.abs(act)) * 100 : 0,
    autonomia_pct: r.activos_totales !== 0 ? (r.patrimonio_total / Math.abs(act)) * 100 : 0,
    roe_pct: r.patrimonio_total !== 0 ? (r.utilidad_neta / Math.abs(pat)) * 100 : 0,
    roa_pct: r.activos_totales !== 0 ? (r.utilidad_neta / Math.abs(act)) * 100 : 0,
  };
}

export function useKpisMesAMes(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["kpis_mes_a_mes", filtros],
    queryFn: async (): Promise<KpiMesRow[]> => {
      let q = supabase.from("v_kpis_mes_a_mes").select("*").order("año_mes_num", { ascending: true });
      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      const { data, error } = await q;
      if (error) throw error;

      // ── Consolidar por mes sumando todas las empresas ────────────────────
      // Los porcentajes NO se promedian — se recalculan desde los valores sumados
      const map = new Map<number, KpiMesRow>();

      for (const r of (data ?? []) as KpiMesRow[]) {
        const key = r.año_mes_num;
        const existing = map.get(key);

        if (!existing) {
          // Primera empresa del mes — guardar valores absolutos tal cual
          map.set(key, {
            ...r,
            compania: filtros.compania === "Todas" ? "Grupo" : r.compania,
            mes_label: r.mes_label || buildLabel(key),
          });
        } else {
          // Sumar valores absolutos — los porcentajes se recalculan al final
          existing.ingresos += Number(r.ingresos) || 0;
          existing.costos += Number(r.costos) || 0;
          existing.gastos_adm += Number(r.gastos_adm) || 0;
          existing.gastos_oper += Number(r.gastos_oper) || 0;
          existing.gastos_fin += Number(r.gastos_fin) || 0;
          existing.utilidad_bruta += Number(r.utilidad_bruta) || 0;
          existing.utilidad_operacional += Number(r.utilidad_operacional) || 0;
          existing.utilidad_neta += Number(r.utilidad_neta) || 0;
          existing.activos_totales += Number(r.activos_totales) || 0;
          existing.pasivos_totales += Number(r.pasivos_totales) || 0;
          existing.patrimonio_total += Number(r.patrimonio_total) || 0;
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Recalcular porcentajes desde valores consolidados
      let arr = Array.from(map.values())
        .map(recomputePcts)
        .sort((a, b) => a.año_mes_num - b.año_mes_num);

      // Recalcular deltas mes a mes desde la serie consolidada
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

      // Si hay dos empresas, consolidar distribución de gastos sumando valores absolutos
      // y recalculando porcentajes desde el total consolidado
      if (filtros.compania === "Todas") {
        const mesMap = new Map<number, { adm: number; oper: number; fin: number; costos: number; total: number }>();
        for (const r of (data ?? []) as any[]) {
          const mes = r.año_mes_num;
          const totalGastos = (r.total_adm || 0) + (r.total_oper || 0) + (r.total_fin || 0) + (r.total_costos || 0);
          if (!mesMap.has(mes)) {
            mesMap.set(mes, {
              adm: r.total_adm || 0,
              oper: r.total_oper || 0,
              fin: r.total_fin || 0,
              costos: r.total_costos || 0,
              total: totalGastos,
            });
          } else {
            const ex = mesMap.get(mes)!;
            ex.adm += r.total_adm || 0;
            ex.oper += r.total_oper || 0;
            ex.fin += r.total_fin || 0;
            ex.costos += r.total_costos || 0;
            ex.total += totalGastos;
          }
        }
        // Si la vista no tiene totales absolutos, fallback a promedio simple
        const hasAbsolutes = (data ?? []).some((r: any) => r.total_adm != null);
        if (!hasAbsolutes) return (data ?? []) as DistribucionGastosRow[];

        return Array.from(mesMap.entries()).map(([mes, v]) => ({
          compania: "Grupo",
          año_mes_num: mes,
          pct_adm: v.total ? (v.adm / v.total) * 100 : 0,
          pct_oper: v.total ? (v.oper / v.total) * 100 : 0,
          pct_fin: v.total ? (v.fin / v.total) * 100 : 0,
          pct_costos: v.total ? (v.costos / v.total) * 100 : 0,
        }));
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

export interface BalanceTotals {
  activos: number;
  pasivos: number;
  patrimonio: number;
}

export function useBalanceFallback(filtros: FiltroDashboard, enabled: boolean) {
  return useQuery({
    queryKey: ["balance_fallback", filtros],
    enabled,
    queryFn: async (): Promise<BalanceTotals> => {
      let q = supabase.from("movimientos").select("clase_cod, saldo_final");
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as { clase_cod: string | null; saldo_final: number | null }[];
      const sumOf = (cls: string) =>
        rows.filter((r) => String(r.clase_cod) === cls).reduce((s, r) => s + (Number(r.saldo_final) || 0), 0);
      const activos = sumOf("1");
      const pasivos = sumOf("2");
      const patrimonio3 = sumOf("3");
      const patrimonio = patrimonio3 !== 0 ? patrimonio3 : activos - pasivos;
      return { activos, pasivos, patrimonio };
    },
  });
}
