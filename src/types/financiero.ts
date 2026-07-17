export type AnioFiltro = number | "Todas";
export type MesFiltro = number | "Todos";
export type CcFiltro = string | "Todas";
export type CompaniaFiltro = string | "Todas";

export interface FiltroDashboard {
  año: AnioFiltro;
  mes: MesFiltro;
  ccKey: CcFiltro;
  compania: CompaniaFiltro;
}

export interface KpisPeriodo {
  compania: string;
  cc_key: string;
  año_mes_num: number;
  ingresos: number;
  otros_ingresos?: number;
  costos: number;
  gastos_adm: number;
  gastos_oper: number;
  gastos_fin: number;
  utilidad_bruta: number;
  utilidad_operacional: number;
  utilidad_neta: number;
  activos_totales: number;
  pasivos_totales: number;
  patrimonio_total: number;
  margen_bruto_pct: number;
  margen_operacional_pct: number;
  margen_neto_pct: number;
  costo_ingreso_pct: number;
  gastos_ingreso_pct: number;
  endeudamiento_pct: number;
  autonomia_pct: number;
  apalancamiento: number;
  roe_pct: number;
  roa_pct: number;
}

export interface TendenciaMensual {
  compania: string;
  cc_key: string;
  año_mes_num: number;
  mes_label: string;
  ingresos: number;
  utilidad_operacional: number;
  margen_operacional_pct: number;
  margen_neto_pct: number;
  utilidad_neta: number;
}

export interface EriRow {
  orden: number;
  concepto: string;
  nivel: number;
  grupo_titulo: string;
  etiqueta_fila: string;
  año_mes_num: number;
  compania: string;
  cc_key: string;
  valor_pyg: number;
}

export interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  activa: boolean | null;
}

export interface CentroCosto {
  id: string;
  codigo: string;
  nombre: string;
  empresa_id: string | null;
  activo: boolean | null;
}