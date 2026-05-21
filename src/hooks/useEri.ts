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
  clase_cod?: string | null;
  grupo_cod?: string | null;
}

export interface EriResumidaRow {
  orden: number;
  concepto: string;
  nivel: string;
  grupo_titulo: string;
  etiqueta_fila: string;
  clase_cod: string;
  grupo_cod: string;
  año_mes_num: number;
  compania: string;
  cc_key: string;
  valor_pyg: number;
}

// Alias para compatibilidad
export type EriValueRow = EriResumidaRow;

export interface EriDetalleRow {
  orden: number;
  año_mes_num: number;
  cc_key: string;
  compania: string;
  valor_pyg: number;
  tercero_key: string;
  nombre_tercero: string;
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

// ─── plan_pyg ─────────────────────────────────────────────────────────────────
export function usePlanPyg() {
  return useQuery({
    queryKey: ["plan_pyg"],
    queryFn: async (): Promise<PlanPygRow[]> => {
      const { data, error } = await supabase
        .from("plan_pyg")
        .select("*")
        .order("orden", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PlanPygRow[];
    },
  });
}

// ─── FUENTE ÚNICA: v_eri_resumida ─────────────────────────────────────────────
// Todas las tabs del ERI leen desde aquí. Nunca mezclar con v_gastos_por_tercero
// para calcular subtotales — eso causaba la inconsistencia entre tabs.

export function useEri(filtros: FiltroDashboard) {
  return useQuery({
    queryKey: ["eri", filtros],
    queryFn: async (): Promise<EriResumidaRow[]> => {
      let q = supabase.from("v_eri_resumida").select("*");
      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "Todas") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data ?? []) as EriResumidaRow[];
    },
  });
}

export function useEriAllMonths(filtros: { año: number | "Todas"; compania: string; ccKey: string }) {
  return useQuery({
    queryKey: ["eri-all-months", filtros],
    queryFn: async (): Promise<EriResumidaRow[]> => {
      let q = supabase.from("v_eri_resumida").select("*");
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "TODOS") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q
        .order("orden", { ascending: true })
        .order("año_mes_num", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as EriResumidaRow[];
    },
  });
}

export function useEriAllCC(filtros: { año: number | "Todas"; compania: string; mes: number | "Todos" }) {
  return useQuery({
    queryKey: ["eri-all-cc", filtros],
    queryFn: async (): Promise<EriResumidaRow[]> => {
      let q = supabase.from("v_eri_resumida").select("*");
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      const { data, error } = await q
        .order("orden", { ascending: true })
        .order("cc_key", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as EriResumidaRow[];
    },
  });
}

// ─── Conteo de terceros ────────────────────────────────────────────────────────
export function useEriTerceroCount(filtros: { año: number | "Todas"; compania: string; mes: number | "Todos" }) {
  return useQuery({
    queryKey: ["eri-tercero-count", filtros],
    queryFn: async (): Promise<Record<number, number>> => {
      let q = supabase.from("v_eri_por_mes").select("orden, tercero_key, cc_key");
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      const counts: Record<number, Set<string>> = {};
      for (const r of (data ?? []) as any[]) {
        if (!counts[r.orden]) counts[r.orden] = new Set();
        counts[r.orden].add(`${r.tercero_key}||${r.cc_key}`);
      }
      const result: Record<number, number> = {};
      for (const [ord, set] of Object.entries(counts)) {
        result[Number(ord)] = set.size;
      }
      return result;
    },
  });
}

// ─── Detalle inline ────────────────────────────────────────────────────────────
export function useEriDetalle(filtros: {
  año: number | "Todas";
  compania: string;
  mes: number | "Todos";
  orden: number | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["eri-detalle", filtros],
    enabled: filtros.enabled && filtros.orden !== null,
    queryFn: async (): Promise<EriDetalleRow[]> => {
      if (!filtros.orden) return [];
      let q = supabase.from("v_eri_por_mes").select("*").eq("orden", filtros.orden);
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as EriDetalleRow[];
    },
  });
}

// ─── Auditoría ─────────────────────────────────────────────────────────────────
export function useEriAuditoria(filtros: {
  año: number | "Todas";
  compania: string;
  mes: number | "Todos";
  ccKey: string;
  orden: number | null;
  search: string;
}) {
  return useQuery({
    queryKey: ["eri-auditoria", filtros],
    enabled: filtros.orden !== null,
    queryFn: async (): Promise<EriDetalleRow[]> => {
      if (!filtros.orden) return [];
      let q = supabase.from("v_eri_por_mes").select("*").eq("orden", filtros.orden);
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      if (filtros.ccKey !== "Todas") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      let rows = (data ?? []) as unknown as EriDetalleRow[];
      if (filtros.search.trim()) {
        const term = filtros.search.toLowerCase();
        rows = rows.filter(
          (r) => r.nombre_tercero?.toLowerCase().includes(term) || r.tercero_key?.toLowerCase().includes(term),
        );
      }
      rows.sort((a, b) => Math.abs(Number(b.valor_pyg)) - Math.abs(Number(a.valor_pyg)));
      return rows;
    },
  });
}

// ─── Gastos por tercero: SOLO para árbol expandible en TabPorCC ───────────────
// NO usar para calcular subtotales — usar v_eri_resumida para eso
export function useGastosTercero(filtros: {
  año: number | "Todas";
  mes: number | "Todos";
  compania: string;
  ccKey: string;
}) {
  return useQuery({
    queryKey: ["gastos-tercero", filtros],
    queryFn: async (): Promise<GastoTerceroRow[]> => {
      let q = supabase.from("v_gastos_por_tercero").select("*").like("cuenta_key", "5%");
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      if (filtros.ccKey !== "TODOS") q = q.eq("cc_key", filtros.ccKey);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as GastoTerceroRow[];
    },
  });
}

export function useGastosPorCC(filtros: { año: number | "Todas"; mes: number | "Todos"; compania: string }) {
  return useQuery({
    queryKey: ["gastos-por-cc", filtros],
    queryFn: async (): Promise<GastoTerceroRow[]> => {
      let q = supabase.from("v_gastos_por_tercero").select("*").like("cuenta_key", "5%");
      if (filtros.año !== "Todas") {
        q = q.gte("año_mes_num", filtros.año * 100 + 1).lte("año_mes_num", filtros.año * 100 + 12);
      }
      if (filtros.mes !== "Todos") q = q.eq("año_mes_num", filtros.mes);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as GastoTerceroRow[];
    },
  });
}
