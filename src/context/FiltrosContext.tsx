import { createContext, useContext, useState, ReactNode } from "react";
import type { FiltroDashboard, AnioFiltro, MesFiltro, CcFiltro, CompaniaFiltro } from "@/types/financiero";

interface FiltrosContextValue extends FiltroDashboard {
  setAño: (v: AnioFiltro) => void;
  setMes: (v: MesFiltro) => void;
  setCcKey: (v: CcFiltro) => void;
  setCompania: (v: CompaniaFiltro) => void;
}

const FiltrosContext = createContext<FiltrosContextValue | undefined>(undefined);

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [año, setAño] = useState<AnioFiltro>(2026);
  const [mes, setMes] = useState<MesFiltro>("Todos");
  const [ccKey, setCcKey] = useState<CcFiltro>("Todas");
  const [compania, setCompania] = useState<CompaniaFiltro>("Todas");

  return (
    <FiltrosContext.Provider value={{ año, mes, ccKey, compania, setAño, setMes, setCcKey, setCompania }}>
      {children}
    </FiltrosContext.Provider>
  );
}

export function useFiltros() {
  const ctx = useContext(FiltrosContext);
  if (!ctx) throw new Error("useFiltros must be used within FiltrosProvider");
  return ctx;
}

/**
 * Build (yyyymm_min, yyyymm_max) from current año/mes filters.
 * año="Todas" → limita al año de datos cargados (2026) para evitar traer todos los años.
 */
export function buildPeriodoRange(año: AnioFiltro, mes: MesFiltro): { min: number; max: number } | null {
  const AÑO_DATOS = 2026; // año con datos cargados en BD

  if (año === "Todas") {
    // No devolver null — limitar al año de datos para evitar sumar 2024+2025+2026+2027
    return { min: AÑO_DATOS * 100 + 1, max: AÑO_DATOS * 100 + 12 };
  }
  if (mes === "Todos") {
    return { min: año * 100 + 1, max: año * 100 + 12 };
  }
  const v = año * 100 + mes;
  return { min: v, max: v };
}
