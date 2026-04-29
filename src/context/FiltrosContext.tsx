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
  const [año, setAño] = useState<AnioFiltro>("Todas");
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
 * Returns null if no year filter (i.e. all-time).
 */
export function buildPeriodoRange(año: AnioFiltro, mes: MesFiltro): { min: number; max: number } | null {
  if (año === "Todas") return null;
  if (mes === "Todos") {
    return { min: año * 100 + 1, max: año * 100 + 12 };
  }
  const v = año * 100 + mes;
  return { min: v, max: v };
}