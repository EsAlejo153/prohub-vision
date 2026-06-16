import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";

export interface AlertaCuentas {
  pendientes_eri: number;
  clasificadas: number;
  ignoradas: number;
  total_detectadas: number;
}

export interface CuentaSinClasificar {
  cuenta_key: string;
  nombre_cuenta: string | null;
  clase_cod: string | null;
  tipo_cuenta: string | null;
  total_movimientos: number | null;
  total_mov_neto: number | null;
  en_plan_pyg: boolean | null;
  ignorada: boolean | null;
  grupo_titulo_actual: string | null;
  signo_actual: number | null;
  estado?: string | null;
}

export interface CentroCostoRow {
  codigo: string;
  nombre_display: string | null;
  primera_vez_vista: string | null;
  ultima_vez_vista: string | null;
  movimientos_count?: number | null;
}

export function useAlertaCuentas() {
  return useQuery({
    queryKey: ["alerta_cuentas"],
    queryFn: async (): Promise<AlertaCuentas> => {
      const { data, error } = await supabase.from("v_alerta_cuentas").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? {
        pendientes_eri: 0,
        clasificadas: 0,
        ignoradas: 0,
        total_detectadas: 0,
      }) as AlertaCuentas;
    },
    refetchInterval: 30_000,
  });
}

export interface CuentasFiltros {
  claseCod?: string; // '4'|'5'|'6'|'BAL' or undefined
  estado?: "sin" | "clasificadas" | "ignoradas" | undefined;
  search?: string;
}

export function useCuentasSinClasificar(filtros: CuentasFiltros) {
  return useQuery({
    queryKey: ["cuentas_sin_clasificar", filtros],
    queryFn: async (): Promise<CuentaSinClasificar[]> => {
      let q = supabase.from("v_cuentas_sin_clasificar").select("*");

      if (filtros.claseCod) {
        if (filtros.claseCod === "BAL") {
          q = q.in("clase_cod", ["1", "2", "3", "7", "8", "9"]);
        } else {
          q = q.eq("clase_cod", filtros.claseCod);
        }
      }
      if (filtros.estado === "sin") {
        q = q.eq("en_plan_pyg", false).eq("ignorada", false);
      } else if (filtros.estado === "clasificadas") {
        q = q.eq("en_plan_pyg", true);
      } else if (filtros.estado === "ignoradas") {
        q = q.eq("ignorada", true);
      }

      const { data, error } = await q.order("cuenta_key", { ascending: true }).limit(1000);
      if (error) throw error;
      let rows = (data ?? []) as CuentaSinClasificar[];
      if (filtros.search) {
        const s = filtros.search.toLowerCase();
        rows = rows.filter(
          (r) => r.cuenta_key?.toLowerCase().includes(s) || r.nombre_cuenta?.toLowerCase().includes(s),
        );
      }
      return rows;
    },
  });
}

export function useGruposPyg() {
  return useQuery({
    queryKey: ["plan_pyg_titulos"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("plan_pyg")
        .select("grupo_titulo, orden")
        .eq("nivel", "Titulo")
        .order("orden", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      const out: string[] = [];
      for (const r of (data ?? []) as Array<{ grupo_titulo: string }>) {
        if (r.grupo_titulo && !seen.has(r.grupo_titulo)) {
          seen.add(r.grupo_titulo);
          out.push(r.grupo_titulo);
        }
      }
      return out;
    },
  });
}

export function useCentrosCostoDim() {
  return useQuery({
    queryKey: ["dim_centros_costo_full"],
    queryFn: async (): Promise<CentroCostoRow[]> => {
      const { data, error } = await supabase
        .from("dim_centros_costo")
        .select("codigo, nombre_display, primera_vez_vista, ultima_vez_vista, movimientos_count")
        .order("codigo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CentroCostoRow[];
    },
  });
}

export async function clasificarCuenta(params: {
  cuenta_key: string;
  grupo_titulo: string | null;
  signo: number;
  ignorar: boolean;
}) {
  const { data, error } = await supabase.rpc("fn_clasificar_cuenta", {
    p_cuenta_key: params.cuenta_key,
    p_grupo_titulo: params.grupo_titulo,
    p_signo: params.signo,
    p_ignorar: params.ignorar,
  });
  if (error) throw error;
  return data;
}

export async function actualizarNombreCC(codigo: string, nombre_display: string | null) {
  const { error } = await supabase.from("dim_centros_costo").update({ nombre_display }).eq("codigo", codigo);
  if (error) throw error;
}

export async function agregarCentroCosto(codigo: string, nombre_display: string) {
  const { error } = await supabase.from("dim_centros_costo").insert({
    codigo,
    nombre_display,
  });
  if (error) throw error;
}
// ─── Tipos para edición ───────────────────────────────────────────────────────
export interface EditarCuentaParams {
  cuenta_key: string;
  grupo_titulo: string;
  tipo_gasto?: string | null;
  detalle_gasto?: string | null;
  nombre_cuenta_jerarquia?: string | null;
}

export interface TipoGastoRow {
  tipo_gasto: string;
  orden_tipo: number;
}

export interface DetalleGastoRow {
  detalle_gasto: string;
  tipo_gasto: string;
  orden_detalle: number;
}

// ─── Hook: tipos de gasto (nivel primario) ────────────────────────────────────
export function useTiposGasto() {
  return useQuery({
    queryKey: ["tipos_gasto"],
    queryFn: async (): Promise<TipoGastoRow[]> => {
      const { data, error } = await supabase
        .from("plan_gastos_jerarquia")
        .select("tipo_gasto, orden_tipo")
        .order("orden_tipo", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      const out: TipoGastoRow[] = [];
      for (const r of (data ?? []) as TipoGastoRow[]) {
        if (!seen.has(r.tipo_gasto)) {
          seen.add(r.tipo_gasto);
          out.push(r);
        }
      }
      return out;
    },
  });
}

// ─── Hook: detalles de gasto (nivel secundario) ───────────────────────────────
export function useDetallesGasto() {
  return useQuery({
    queryKey: ["detalles_gasto"],
    queryFn: async (): Promise<DetalleGastoRow[]> => {
      const { data, error } = await supabase
        .from("plan_gastos_jerarquia")
        .select("detalle_gasto, tipo_gasto, orden_detalle")
        .order("orden_detalle", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      const out: DetalleGastoRow[] = [];
      for (const r of (data ?? []) as DetalleGastoRow[]) {
        if (!seen.has(`${r.tipo_gasto}||${r.detalle_gasto}`)) {
          seen.add(`${r.tipo_gasto}||${r.detalle_gasto}`);
          out.push(r);
        }
      }
      return out;
    },
  });
}

// ─── Hook: jerarquía actual de una cuenta clase 5 ────────────────────────────
export function useJerarquiaCuenta(cuenta_key: string | null) {
  return useQuery({
    queryKey: ["jerarquia_cuenta", cuenta_key],
    enabled: !!cuenta_key,
    queryFn: async (): Promise<(DetalleGastoRow & { nombre_cuenta: string }) | null> => {
      if (!cuenta_key) return null;
      const { data, error } = await supabase
        .from("plan_gastos_jerarquia")
        .select("tipo_gasto, detalle_gasto, nombre_cuenta, orden_tipo, orden_detalle")
        .eq("cuenta", cuenta_key)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

// ─── Función: editar cuenta ───────────────────────────────────────────────────
export async function editarCuenta(params: EditarCuentaParams) {
  const { data, error } = await supabase.rpc("fn_editar_cuenta", {
    p_cuenta_key: params.cuenta_key,
    p_grupo_titulo: params.grupo_titulo,
    p_tipo_gasto: params.tipo_gasto ?? null,
    p_detalle_gasto: params.detalle_gasto ?? null,
    p_nombre_cuenta_jerarquia: params.nombre_cuenta_jerarquia ?? null,
  });
  if (error) throw error;
  if (data && !data.ok) throw new Error(data.error ?? "Error al editar cuenta");
  return data;
}
