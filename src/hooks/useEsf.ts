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

      // Traer cuentas normales (no CuentaERI)
      let q = supabase
        .from("v_esf_resumida")
        .select("*")
        .eq("año_mes_num", filtros.año_mes_num)
        .neq("nivel", "CuentaERI")
        .order("orden", { ascending: true });
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      const { data, error } = await q.limit(500);
      if (error) throw error;

      // Traer CuentaERI por separado
      let q2 = supabase
        .from("v_esf_resumida")
        .select("*")
        .eq("año_mes_num", filtros.año_mes_num)
        .eq("nivel", "CuentaERI");
      if (filtros.compania !== "Todas") q2 = q2.eq("compania", filtros.compania);
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
