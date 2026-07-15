import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";

export interface EsfRow {
  compania: string;
  año_mes_num: number;
  orden: number;
  nivel: string;
  seccion: string;
  grupo_titulo: string | null;
  concepto: string;
  cuenta_key: string | null;
  signo: number;
  orden_grupo: number;
  valor_presentacion: number | null;
  debito_acum: number | null;
  credito_acum: number | null;
  saldo_acum: number | null;
}

export interface PlanEsfRow {
  orden: number;
  nivel: string;
  seccion: string;
  grupo_titulo: string | null;
  concepto: string;
  cuenta_key: string | null;
  signo: number;
  orden_grupo: number;
}

export function useEsf(filtros: { año_mes_num: number | null; compania: string }) {
  return useQuery({
    queryKey: ["esf", filtros],
    enabled: !!filtros.año_mes_num,
    queryFn: async (): Promise<EsfRow[]> => {
      if (!filtros.año_mes_num) return [];

      // v_esf_resumida ya trae una fila pre-consolidada con compania = 'Todas'
      // que suma correctamente todas las empresas por cuenta. Por eso "Todas"
      // deja de significar "sin filtro" aquí: es un valor real de la columna
      // compania, igual que "IQLICK" o "PROHUB S.A.S.", y siempre se filtra.

      // Traer cuentas normales (no CuentaERI)
      const q = supabase
        .from("v_esf_resumida")
        .select("*")
        .eq("año_mes_num", filtros.año_mes_num)
        .eq("compania", filtros.compania)
        .neq("nivel", "CuentaERI")
        .order("orden", { ascending: true });
      const { data, error } = await q.limit(500);
      if (error) throw error;

      // Traer CuentaERI por separado
      const q2 = supabase
        .from("v_esf_resumida")
        .select("*")
        .eq("año_mes_num", filtros.año_mes_num)
        .eq("compania", filtros.compania)
        .eq("nivel", "CuentaERI");
      const { data: data2, error: error2 } = await q2.limit(50);
      if (error2) throw error2;

      return [...((data ?? []) as EsfRow[]), ...((data2 ?? []) as EsfRow[])];
    },
  });
}

export function useMesesEsf(compania: string) {
  return useQuery({
    queryKey: ["esf-meses", compania],
    queryFn: async (): Promise<number[]> => {
      // OJO: esta consulta va directo contra movimientos (no contra la vista
      // consolidada), así que aquí "Todas" SÍ debe seguir significando
      // "sin filtro, cualquier compañía" — movimientos.compania nunca tiene
      // el valor literal 'Todas'. No tocar este patrón.
      let q = supabase
        .from("movimientos")
        .select("año_mes_num")
        .in("clase_cod", ["1", "2", "3"])
        .not("año_mes_num", "is", null);
      if (compania !== "Todas") q = q.eq("compania", compania);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      const seen = new Set<number>();
      for (const r of (data ?? []) as any[]) {
        if (r.año_mes_num) seen.add(Number(r.año_mes_num));
      }
      return Array.from(seen).sort((a, b) => b - a);
    },
  });
}

export function usePlanEsf() {
  return useQuery({
    queryKey: ["plan_esf"],
    queryFn: async (): Promise<PlanEsfRow[]> => {
      const { data, error } = await supabase.from("plan_esf").select("*").order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanEsfRow[];
    },
  });
}

export async function cargarAuxiliarEsf(params: {
  filas: Array<{
    cuenta_key: string;
    nombre_cuenta: string;
    debito: number;
    credito: number;
    saldo_anterior: number;
    saldo_final: number;
  }>;
  compania: string;
  año_mes_num: number;
  nombre_archivo: string;
}) {
  const { data, error } = await supabase.rpc("fn_cargar_auxiliar_esf", {
    p_filas: params.filas,
    p_compania: params.compania,
    p_año_mes_num: params.año_mes_num,
    p_nombre_archivo: params.nombre_archivo,
  });
  if (error) throw error;
  if (data && !data.ok) throw new Error(data.error ?? "Error al cargar ESF");
  return data;
}
export interface EsfTerceroRow {
  compania: string;
  año_mes_num: number;
  orden_cuenta: number;
  plan_cuenta_key: string;
  concepto_cuenta: string;
  signo: number;
  cuenta_mov: string;
  tercero_key: string;
  nombre_tercero: string | null;
  valor_presentacion: number;
}

export function useEsfTerceros(filtros: { año_mes_num: number | null; compania: string }) {
  return useQuery({
    queryKey: ["esf-terceros", filtros],
    enabled: !!filtros.año_mes_num,
    queryFn: async (): Promise<EsfTerceroRow[]> => {
      if (!filtros.año_mes_num) return [];
      // Mismo criterio que useEsf: v_esf_terceros también trae un bucket
      // compania = 'Todas' pre-consolidado, así que siempre se filtra.
      const q = supabase
        .from("v_esf_terceros")
        .select("*")
        .eq("año_mes_num", filtros.año_mes_num)
        .eq("compania", filtros.compania)
        .order("orden_cuenta", { ascending: true })
        .order("valor_presentacion", { ascending: false });
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data ?? []) as EsfTerceroRow[];
    },
  });
}
