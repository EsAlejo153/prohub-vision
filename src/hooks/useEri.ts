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

export interface EriCompactRow {
  orden: number;
  año_mes_num: number;
  cc_key: string;
  compania: string;
  valor_pyg: number;
}

export function useEriAllMonths(filtros: {
  año: number | "Todas";
  compania: string;
  ccKey: string;
}) {
  return useQuery({
    queryKey: ["eri-all-months", filtros],
    queryFn: async (): Promise<EriCompactRow[]> => {
      let q = supabase.from("v_eri_por_mes").select("*");
      if (filtros.año !== "Todas") {
        q = q
          .gte("año_mes_num", filtros.año * 100 + 1)
          .lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "TODOS") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q
        .order("orden", { ascending: true })
        .order("año_mes_num", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EriCompactRow[];
    },
  });
}

export function useEriAllCC(filtros: {
  año: number | "Todas";
  compania: string;
  mes: number | "Todos";
}) {
  return useQuery({
    queryKey: ["eri-all-cc", filtros],
    queryFn: async (): Promise<EriCompactRow[]> => {
      let q = supabase.from("v_eri_por_mes").select("*");
      if (filtros.año !== "Todas") {
        q = q
          .gte("año_mes_num", filtros.año * 100 + 1)
          .lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      const { data, error } = await q
        .order("orden", { ascending: true })
        .order("cc_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EriCompactRow[];
    },
  });
}

export interface GastoTerceroRow {
  compania: string;
  cc_key: string;
  año_mes_num: number;
  cuenta_key: string;
  tipo_gasto: string;
  detalle_gasto: string;
  nombre_cuenta: string;
  orden_tipo: number;
  orden_detalle: number;
  nit: string;
  tercero_nombre: string;
  gasto_real: number;
}

export function useGastosTercero(filtros: {
  año: number | "Todas";
  mes: number | "Todos";
  compania: string;
  ccKey: string;
}) {
  return useQuery({
    queryKey: ["gastos-tercero", filtros],
    queryFn: async (): Promise<GastoTerceroRow[]> => {
      let q = supabase.from("v_gastos_por_tercero").select("*");
      if (filtros.año !== "Todas") {
        q = q
          .gte("año_mes_num", filtros.año * 100 + 1)
          .lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "TODOS") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as GastoTerceroRow[];
    },
  });
}
