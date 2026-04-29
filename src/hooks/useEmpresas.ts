import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import type { Empresa } from "@/types/financiero";

export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase
        .from("dim_empresas")
        .select("id, nombre, nit, activa")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });
}