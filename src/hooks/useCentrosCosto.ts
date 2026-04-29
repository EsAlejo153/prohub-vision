import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { CentroCosto } from "@/types/financiero";

export function useCentrosCosto(empresaId?: string) {
  return useQuery({
    queryKey: ["centros_costo", empresaId ?? "all"],
    queryFn: async (): Promise<CentroCosto[]> => {
      let q = supabase
        .from("dim_centros_costo")
        .select("id, codigo, nombre, empresa_id, activo")
        .order("nombre", { ascending: true });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CentroCosto[];
    },
  });
}