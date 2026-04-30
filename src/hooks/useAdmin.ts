import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";

export interface PerfilRow {
  id: string;
  nombre?: string | null;
  email?: string | null;
  rol?: "admin" | "contador" | "viewer" | string | null;
  empresa_id?: string | null;
  activo?: boolean | null;
}

export function usePerfil(userId: string | undefined) {
  return useQuery({
    queryKey: ["perfil", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PerfilRow | null> => {
      const { data, error } = await supabase
        .from("perfiles")
        .select("id, nombre, email, rol, empresa_id, activo")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PerfilRow | null;
    },
  });
}

export interface HistorialCargue {
  archivo_id: string;
  nombre_archivo: string;
  compania: string | null;
  periodo: string | null;
  created_at: string;
  subido_por_email: string | null;
  total_filas: number | null;
  filas_insertadas: number | null;
  filas_rechazadas: number | null;
  movimientos_actuales: number | null;
  estado: string;
  mensaje_error: string | null;
  puede_revertir: boolean | null;
}

export function useHistorialCargues() {
  return useQuery({
    queryKey: ["historial_cargues"],
    queryFn: async (): Promise<HistorialCargue[]> => {
      const { data, error } = await supabase
        .from("v_historial_cargues")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistorialCargue[];
    },
  });
}

export interface UsuarioRow {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
  total_cargues: number | null;
  ultimo_acceso: string | null;
  activo: boolean | null;
}

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios_admin"],
    queryFn: async (): Promise<UsuarioRow[]> => {
      const { data, error } = await supabase.from("v_usuarios").select("*");
      if (error) throw error;
      return (data ?? []) as UsuarioRow[];
    },
  });
}

export interface AuditLogRow {
  id: string;
  accion: string;
  usuario_email: string | null;
  descripcion: string | null;
  created_at: string;
  severidad: "danger" | "warning" | "info" | string;
  icono: string | null;
  registros_afectados: number | null;
  valor_antes: unknown;
  valor_despues: unknown;
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit_log"],
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase
        .from("v_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
  });
}

export async function revertirCargue(archivo_id: string) {
  const { data, error } = await supabase.rpc("fn_revertir_cargue", {
    p_archivo_id: archivo_id,
  });
  if (error) throw error;
  return data;
}

export async function cambiarRol(usuario_id: string, nuevo_rol: string) {
  const { data, error } = await supabase.rpc("fn_cambiar_rol", {
    p_usuario_id: usuario_id,
    p_nuevo_rol: nuevo_rol,
  });
  if (error) throw error;
  return data;
}

export async function cambiarEmpresa(usuario_id: string, empresa_id: string | null) {
  const { error } = await supabase
    .from("perfiles")
    .update({ empresa_id })
    .eq("id", usuario_id);
  if (error) throw error;
}

export async function desactivarUsuario(usuario_id: string, activo: boolean) {
  const { error } = await supabase
    .from("perfiles")
    .update({ activo })
    .eq("id", usuario_id);
  if (error) throw error;
}

export async function editarMovimiento(
  id: string,
  cambios: { concepto?: string; cc_key?: string; debito?: number; credito?: number },
) {
  const { data, error } = await supabase.rpc("fn_editar_movimiento", {
    p_id: id,
    p_cambios: cambios,
  });
  if (error) throw error;
  return data;
}

export async function eliminarMovimiento(id: string, motivo: string) {
  const { data, error } = await supabase.rpc("fn_eliminar_movimiento", {
    p_id: id,
    p_motivo: motivo,
  });
  if (error) throw error;
  return data;
}

export interface MovimientoRow {
  id: string;
  fecha: string;
  cuenta_key: string;
  nombre_cuenta: string | null;
  concepto: string | null;
  cc_key: string | null;
  debito: number | null;
  credito: number | null;
  mov_neto: number | null;
  compania: string | null;
  año_mes_num: number | null;
}

export interface MovimientosFiltros {
  cuenta?: string;
  concepto?: string;
  compania?: string;
  añoMes?: number;
  page?: number;
}

export function useMovimientos(filtros: MovimientosFiltros, enabled: boolean) {
  const page = filtros.page ?? 0;
  const pageSize = 50;
  return useQuery({
    queryKey: ["movimientos_admin", filtros],
    enabled,
    queryFn: async (): Promise<{ rows: MovimientoRow[]; count: number }> => {
      let q = supabase
        .from("movimientos")
        .select(
          "id, fecha, cuenta_key, nombre_cuenta, concepto, cc_key, debito, credito, mov_neto, compania, año_mes_num",
          { count: "exact" },
        );
      if (filtros.cuenta) q = q.ilike("cuenta_key", `${filtros.cuenta}%`);
      if (filtros.concepto) q = q.ilike("concepto", `%${filtros.concepto}%`);
      if (filtros.compania) q = q.eq("compania", filtros.compania);
      if (filtros.añoMes) q = q.eq("año_mes_num", filtros.añoMes);
      const { data, error, count } = await q
        .order("fecha", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as MovimientoRow[], count: count ?? 0 };
    },
  });
}

export function useDistinctMeses() {
  return useQuery({
    queryKey: ["distinct_meses"],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("v_kpis_periodo")
        .select("año_mes_num")
        .order("año_mes_num", { ascending: false });
      if (error) throw error;
      const set = new Set<number>();
      for (const r of (data ?? []) as Array<{ año_mes_num: number }>) {
        if (r.año_mes_num) set.add(r.año_mes_num);
      }
      return Array.from(set);
    },
  });
}

export function useDistinctCompanias() {
  return useQuery({
    queryKey: ["distinct_companias"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("dim_empresas")
        .select("nombre")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: { nombre: string }) => r.nombre);
    },
  });
}