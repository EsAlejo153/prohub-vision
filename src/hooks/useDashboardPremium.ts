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
  cuenta_codigo: string;
  cuenta_nombre: string;
  valor: number;
  participacion_pct: number;
}

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function buildLabel(yyyymm: number) {
  const m = yyyymm % 100;
  return MES_LABELS[m - 1] ?? String(m);
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

      // Aggregate by month across companies / cc
      const map = new Map<number, KpiMesRow>();
      for (const r of (data ?? []) as KpiMesRow[]) {
        const key = r.año_mes_num;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...r, mes_label: r.mes_label || buildLabel(key) });
        } else {
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
          existing.margen_bruto_pct = (existing.margen_bruto_pct + Number(r.margen_bruto_pct)) / 2;
          existing.margen_operacional_pct = (existing.margen_operacional_pct + Number(r.margen_operacional_pct)) / 2;
          existing.margen_neto_pct = (existing.margen_neto_pct + Number(r.margen_neto_pct)) / 2;
          existing.costo_ingreso_pct = (existing.costo_ingreso_pct + Number(r.costo_ingreso_pct)) / 2;
          existing.endeudamiento_pct = (existing.endeudamiento_pct + Number(r.endeudamiento_pct)) / 2;
          existing.autonomia_pct = (existing.autonomia_pct + Number(r.autonomia_pct)) / 2;
          existing.roe_pct = (existing.roe_pct + Number(r.roe_pct)) / 2;
          existing.roa_pct = (existing.roa_pct + Number(r.roa_pct)) / 2;
        }
      }
      const arr = Array.from(map.values()).sort((a, b) => a.año_mes_num - b.año_mes_num);
      // Recompute deltas based on aggregated series
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i];
        const prev = i > 0 ? arr[i - 1] : null;
        cur.delta_ingresos_pct = prev && prev.ingresos ? ((cur.ingresos - prev.ingresos) / Math.abs(prev.ingresos)) * 100 : null;
        cur.delta_util_oper_pct = prev && prev.utilidad_operacional ? ((cur.utilidad_operacional - prev.utilidad_operacional) / Math.abs(prev.utilidad_operacional)) * 100 : null;
        cur.delta_util_neta_pct = prev && prev.utilidad_neta ? ((cur.utilidad_neta - prev.utilidad_neta) / Math.abs(prev.utilidad_neta)) * 100 : null;
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