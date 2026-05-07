import { Fragment, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useFiltros } from "@/context/FiltrosContext";
import {
  useEri,
  usePlanPyg,
  useEriAllMonths,
  useEriAllCC,
  useGastosPorCC,
  type GastoTerceroRow,
  type PlanPygRow,
} from "@/hooks/useEri";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/dashboard/StateMessages";
import type { FiltroDashboard } from "@/types/financiero";

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(yyyymm: number) {
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  return `${MES_LABELS[m - 1] ?? m} ${String(y).slice(2)}`;
}

function formatCell(v: number | null | undefined): { text: string; negative: boolean; zero: boolean } {
  if (v == null || !Number.isFinite(v) || v === 0) return { text: "-", negative: false, zero: true };
  if (v < 0) {
    return { text: `(${Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 0 })})`, negative: true, zero: false };
  }
  return { text: v.toLocaleString("es-CO", { maximumFractionDigits: 0 }), negative: false, zero: false };
}

const CENTROS = [
  { key: "TODOS", label: "Consolidado" },
  { key: "01-PRINCIPAL", label: "Principal" },
  { key: "02-TIENDA CENTRO", label: "Tienda Centro" },
  { key: "03-DIGITAL", label: "Digital" },
  { key: "04-MONTERREY", label: "Monterrey" },
];

type TabId = "periodo" | "mes-a-mes" | "por-cc";

export default function Eri() {
  const filtros = useFiltros();
  const plan = usePlanPyg();
  const [activeTab, setActiveTab] = useState<TabId>("periodo");

  const tabs: { id: TabId; label: string }[] = [
    { id: "periodo", label: "Período" },
    { id: "mes-a-mes", label: "Mes a mes" },
    { id: "por-cc", label: "Por centro de costo" },
  ];

  return (
    <AppLayout title="Estado de Resultados">
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "periodo" && <TabPeriodo plan={plan} filtros={filtros} />}
      {activeTab === "mes-a-mes" && <TabMesAMes plan={plan} filtros={filtros} />}
      {activeTab === "por-cc" && <TabPorCC plan={plan} filtros={filtros} />}
    </AppLayout>
  );
}

type PlanQuery = ReturnType<typeof usePlanPyg>;

interface TabProps {
  plan: PlanQuery;
  filtros: FiltroDashboard;
}

function CcPills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {CENTROS.map((cc) => (
        <button
          key={cc.key}
          onClick={() => onChange(cc.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === cc.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {cc.label}
        </button>
      ))}
    </div>
  );
}

function rowStyling(nivel: string, signed: number, idx: number) {
  const isTitulo = nivel === "Titulo";
  const isTotal = nivel === "Total";
  const isSubtotal = nivel === "Subtotal";
  let rowStyle: React.CSSProperties = {};
  let rowClass = "border-b border-border/40";
  if (isTitulo) {
    rowStyle.background = "#1e2d42";
    rowClass += " font-bold text-foreground";
  } else if (isTotal) {
    rowStyle.background = signed >= 0 ? "#1a2d1a" : "#2d1a1a";
    rowClass += " font-bold";
  } else if (isSubtotal) {
    rowClass += " font-bold text-[12px] border-l-2 border-l-primary bg-background/40";
  } else {
    rowClass += idx % 2 === 0 ? " bg-background/20" : "";
  }
  return { rowStyle, rowClass, isTitulo };
}

function TabPeriodo({ plan, filtros }: TabProps) {
  const [ccActivo, setCcActivo] = useState("TODOS");
  const eri = useEri({
    ...filtros,
    ccKey: ccActivo === "TODOS" ? "Todas" : ccActivo,
  });

  const { planRows, valueMap, ingresosTotales } = useMemo(() => {
    const planRows: PlanPygRow[] = plan.data ?? [];
    const map = new Map<number, number>();
    for (const r of eri.data ?? []) {
      map.set(r.orden, (map.get(r.orden) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    const ingresos = Math.abs(map.get(15) ?? 0) || 1;
    return { planRows, valueMap: map, ingresosTotales: ingresos };
  }, [plan.data, eri.data]);

  const isLoading = plan.isLoading || eri.isLoading;
  const isError = plan.isError || eri.isError;

  const ccLabel = CENTROS.find((c) => c.key === ccActivo)?.label;
  const periodoLabel =
    filtros.año === "Todas"
      ? "Acumulado total"
      : filtros.mes === "Todos"
      ? `Acumulado ${filtros.año}`
      : `${mesLabel((filtros.año as number) * 100 + (filtros.mes as number))}`;

  return (
    <div>
      <CcPills value={ccActivo} onChange={setCcActivo} />
      <p className="mb-3 text-xs text-muted-foreground">
        {periodoLabel} · {ccLabel}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState />
      ) : planRows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="w-[55%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  % Ingr.
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row, idx) => {
                const val = valueMap.get(row.orden) ?? 0;
                const pct =
                  row.nivel !== "Titulo" && ingresosTotales !== 0
                    ? (val / ingresosTotales) * 100
                    : null;
                const fVal = formatCell(val);
                const { rowStyle, rowClass, isTitulo } = rowStyling(row.nivel, val, idx);
                return (
                  <tr key={row.orden} className={rowClass} style={rowStyle}>
                    <td className="px-3 py-1.5 text-foreground">
                      {row.etiqueta_fila || row.concepto}
                    </td>
                    {isTitulo ? (
                      <>
                        <td />
                        <td />
                      </>
                    ) : (
                      <>
                        <td
                          className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                            fVal.negative
                              ? "text-destructive"
                              : fVal.zero
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {fVal.text}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {pct != null ? `${pct.toFixed(2)}%` : ""}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CC_KEYS = [
  { key: "01-PRINCIPAL", label: "Principal" },
  { key: "02-TIENDA CENTRO", label: "Tienda Centro" },
  { key: "03-DIGITAL", label: "Digital" },
  { key: "04-MONTERREY", label: "Monterrey" },
];

interface ValoresPorCC { [ccKey: string]: number }
interface Nivel4CC { tercero: string; nit: string; valores: ValoresPorCC }
interface Nivel3CC { nombre_cuenta: string; valores: ValoresPorCC; terceros: Nivel4CC[] }
interface Nivel2CC { detalle_gasto: string; valores: ValoresPorCC; cuentas: Nivel3CC[] }
interface Nivel1CC { tipo_gasto: string; valores: ValoresPorCC; detalles: Nivel2CC[] }

function buildTreeCC(rows: GastoTerceroRow[]): Nivel1CC[] {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = `${r.tipo_gasto}||${r.detalle_gasto}||${r.nombre_cuenta}||${r.tercero_nombre}||${r.nit}`;
    if (!map.has(key)) map.set(key, new Map());
    const ccMap = map.get(key)!;
    ccMap.set(r.cc_key, (ccMap.get(r.cc_key) ?? 0) + (Number(r.gasto_real) || 0));
  }
  const n1Map = new Map<string, Nivel1CC>();
  for (const [key, ccMap] of map.entries()) {
    const [tipo, detalle, nombre, tercero, nit] = key.split("||");
    const terceroClean = tercero?.replace(/\d+$/, '').trim() || 'Sin identificar';
    const valores: ValoresPorCC = {};
    for (const [cc, v] of ccMap.entries()) valores[cc] = v;
    if (!n1Map.has(tipo)) n1Map.set(tipo, { tipo_gasto: tipo, valores: {}, detalles: [] });
    const n1 = n1Map.get(tipo)!;
    for (const [cc, v] of Object.entries(valores)) n1.valores[cc] = (n1.valores[cc] ?? 0) + v;
    let n2 = n1.detalles.find((d) => d.detalle_gasto === detalle);
    if (!n2) { n2 = { detalle_gasto: detalle, valores: {}, cuentas: [] }; n1.detalles.push(n2); }
    for (const [cc, v] of Object.entries(valores)) n2.valores[cc] = (n2.valores[cc] ?? 0) + v;
    let n3 = n2.cuentas.find((c) => c.nombre_cuenta === nombre);
    if (!n3) { n3 = { nombre_cuenta: nombre, valores: {}, terceros: [] }; n2.cuentas.push(n3); }
    for (const [cc, v] of Object.entries(valores)) n3.valores[cc] = (n3.valores[cc] ?? 0) + v;
    n3.terceros.push({ tercero: terceroClean, nit, valores });
  }
  const consolidado = (vals: ValoresPorCC) => Object.values(vals).reduce((s, v) => s + v, 0);
  return Array.from(n1Map.values())
    .sort((a, b) => a.tipo_gasto.localeCompare(b.tipo_gasto))
    .map((n1) => ({
      ...n1,
      detalles: n1.detalles
        .sort((a, b) => a.detalle_gasto.localeCompare(b.detalle_gasto))
        .map((n2) => ({
          ...n2,
          cuentas: n2.cuentas
            .sort((a, b) => a.nombre_cuenta.localeCompare(b.nombre_cuenta))
            .map((n3) => ({
              ...n3,
              terceros: n3.terceros.sort((a, b) => consolidado(b.valores) - consolidado(a.valores)),
            })),
        })),
    }));
}

function TabPorCC({ plan, filtros }: TabProps) {
  const [mesLocal, setMesLocal] = useState<number | "Todos">("Todos");
  const gastos = useGastosPorCC({
    año: filtros.año,
    mes: mesLocal,
    compania: filtros.compania,
  });
  const eriCC = useEriAllCC({
    año: filtros.año,
    compania: filtros.compania,
    mes: mesLocal,
  });
  const tree = useMemo(() => buildTreeCC(gastos.data ?? []), [gastos.data]);

  const eriMap = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const r of eriCC.data ?? []) {
      let inner = m.get(r.orden);
      if (!inner) { inner = new Map(); m.set(r.orden, inner); }
      inner.set(r.cc_key, (inner.get(r.cc_key) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return m;
  }, [eriCC.data]);

  const getCCVals = (orden: number): ValoresPorCC => {
    const inner = eriMap.get(orden);
    if (!inner) return {};
    const r: ValoresPorCC = {};
    for (const [cc, v] of inner.entries()) r[cc] = v;
    return r;
  };

  const [openN1, setOpenN1] = useState<Set<string>>(new Set());
  const [openN2, setOpenN2] = useState<Set<string>>(new Set());
  const [openN3, setOpenN3] = useState<Set<string>>(new Set());
  const [openIngreso, setOpenIngreso] = useState<Set<number>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['ingresos', 'costos', 'otros-ingresos', 'gastos-oper', 'otros-gastos'])
  );
  const toggleSection = (k: string) =>
    setOpenSections(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });
  const toggleIngreso = (orden: number) =>
    setOpenIngreso(prev => { const s = new Set(prev); s.has(orden) ? s.delete(orden) : s.add(orden); return s; });

  const ingresoTercerosMap = useMemo(() => {
    const map = new Map<number, Map<string, Map<string, number>>>();
    for (const r of eriCC.data ?? []) {
      if (!map.has(r.orden)) map.set(r.orden, new Map());
      const ccMap = map.get(r.orden)!;
      if (!ccMap.has(r.cc_key)) ccMap.set(r.cc_key, new Map());
      const nombre = (r as any).concepto?.replace(/\d+$/, '').trim() || 'Sin detalle';
      const tercMap = ccMap.get(r.cc_key)!;
      tercMap.set(nombre, (tercMap.get(nombre) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return map;
  }, [eriCC.data]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (k: string) =>
    setter((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k); else s.add(k);
      return s;
    });
  const toggleN1 = toggle(setOpenN1);
  const toggleN2 = toggle(setOpenN2);
  const toggleN3 = toggle(setOpenN3);

  const expandAll = () => {
    setOpenSections(new Set(['ingresos','costos','otros-ingresos','gastos-oper','otros-gastos']));
    setOpenN1(new Set(tree.map((n) => n.tipo_gasto)));
    setOpenN2(new Set(tree.flatMap((n) => n.detalles.map((d) => `${n.tipo_gasto}||${d.detalle_gasto}`))));
    setOpenN3(new Set(tree.flatMap((n) => n.detalles.flatMap((d) =>
      d.cuentas.map((c) => `${n.tipo_gasto}||${d.detalle_gasto}||${c.nombre_cuenta}`)
    ))));
  };
  const collapseAll = () => { setOpenSections(new Set()); setOpenN1(new Set()); setOpenN2(new Set()); setOpenN3(new Set()); };

  const getConsolidado = (vals: ValoresPorCC) =>
    CC_KEYS.reduce((s, cc) => s + (vals[cc.key] ?? 0), 0);

  const planRows: PlanPygRow[] = plan.data ?? [];
  const ingresosCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && (r as any).clase_cod === "4" && (r as any).grupo_cod === "41"
  );
  const otrosIngresosCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && (r as any).clase_cod === "4" && (r as any).grupo_cod === "42"
  );
  const costosCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && (r as any).clase_cod === "6"
  );

  const vTotalIngresos: ValoresPorCC = {};
  for (const row of ingresosCuentas) {
    const v = getCCVals(row.orden);
    for (const cc of CC_KEYS) {
      vTotalIngresos[cc.key] = (vTotalIngresos[cc.key] ?? 0) + (v[cc.key] ?? 0);
    }
  }
  const vTotalCostos: ValoresPorCC = {};
  for (const row of costosCuentas) {
    const v = getCCVals(row.orden);
    for (const cc of CC_KEYS) {
      vTotalCostos[cc.key] = (vTotalCostos[cc.key] ?? 0) + (v[cc.key] ?? 0);
    }
  }

  const vUtilidadBruta: ValoresPorCC = {};
  for (const cc of CC_KEYS) {
    vUtilidadBruta[cc.key] = (vTotalIngresos[cc.key] ?? 0) + (vTotalCostos[cc.key] ?? 0);
  }

  const gastosOperTree = tree.find((n) => n.tipo_gasto === "01.GASTOS OPERACIONALES");
  const gastosNoOperTree = tree.find((n) => n.tipo_gasto === "02.GASTO NO OPERACIONAL");

  const vGastosOper = gastosOperTree?.valores ?? {};
  const vUtilidadOper: ValoresPorCC = {};
  for (const cc of CC_KEYS) {
    vUtilidadOper[cc.key] = (vUtilidadBruta[cc.key] ?? 0) - (vGastosOper[cc.key] ?? 0);
  }

  const vOtrosIngresos: ValoresPorCC = {};
  for (const row of otrosIngresosCuentas) {
    const v = getCCVals(row.orden);
    for (const cc of CC_KEYS) {
      vOtrosIngresos[cc.key] = (vOtrosIngresos[cc.key] ?? 0) + (v[cc.key] ?? 0);
    }
  }
  const vOtrosGastos = gastosNoOperTree?.valores ?? {};

  const vUtilidadAI: ValoresPorCC = {};
  for (const cc of CC_KEYS) {
    vUtilidadAI[cc.key] =
      (vUtilidadOper[cc.key] ?? 0) + (vOtrosIngresos[cc.key] ?? 0) - (vOtrosGastos[cc.key] ?? 0);
  }

  const año = filtros.año === "Todas" ? 2026 : Number(filtros.año);
  const mesesDisponibles: { value: number | "Todos"; label: string }[] = [
    { value: "Todos", label: "Acumulado" },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
      value: año * 100 + m,
      label: mesLabel(año * 100 + m),
    })),
  ];

  const colClass = "px-2 py-1.5 text-right text-[11px] tabular-nums whitespace-nowrap min-w-[110px]";

  const renderCellVal = (vals: ValoresPorCC, cc: { key: string }, bold = false) => {
    const f = formatCell(vals[cc.key] ?? 0);
    return (
      <td key={cc.key} className={`${colClass} ${bold ? "font-bold" : ""} ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"}`}>{f.text}</td>
    );
  };
  const renderConsCell = (vals: ValoresPorCC, bold = false) => {
    const v = getConsolidado(vals);
    const f = formatCell(v);
    return (
      <td className={`${colClass} ${bold ? "font-bold" : ""} ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-primary"}`}>{f.text}</td>
    );
  };
  const totalIngresos = getConsolidado(vTotalIngresos) || 1;
  const renderPctCell = (vals: ValoresPorCC, bold = false) => {
    const v = getConsolidado(vals);
    if (!v) return <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground/30 whitespace-nowrap min-w-[70px]">-</td>;
    const pct = (v / totalIngresos) * 100;
    return (
      <td className={`px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[70px] ${bold ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
        {pct.toFixed(2)}%
      </td>
    );
  };
  const renderCCPct = (vals: ValoresPorCC, cc: { key: string }, bold = false) => {
    const ccIngreso = vTotalIngresos[cc.key] ?? 0;
    const v = vals[cc.key] ?? 0;
    if (!v || !ccIngreso) return (
      <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground/20 whitespace-nowrap min-w-[55px]">-</td>
    );
    const pct = (v / ccIngreso) * 100;
    return (
      <td className={`px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[55px] ${bold ? 'font-bold' : ''} text-muted-foreground/70`}>
        {pct.toFixed(2)}%
      </td>
    );
  };
  const renderConsPct = (vals: ValoresPorCC, bold = false) => {
    const v = getConsolidado(vals);
    if (!v || Math.abs(totalIngresos) < 1) return (
      <td className="px-2 py-1.5 text-right text-[10px] whitespace-nowrap min-w-[60px] text-muted-foreground/20">-</td>
    );
    const pct = (v / totalIngresos) * 100;
    return (
      <td className={`px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[60px] ${bold ? 'font-bold' : ''} text-muted-foreground/70`}>
        {pct.toFixed(2)}%
      </td>
    );
  };

  const SectionHeader = ({ label, sectionKey }: { label: string; sectionKey: string }) => {
    const isOpen = openSections.has(sectionKey);
    return (
      <tr
        style={{ background: "#1e2d42" }}
        className="cursor-pointer hover:opacity-90"
        onClick={() => toggleSection(sectionKey)}
      >
        <td colSpan={CC_KEYS.length * 2 + 3} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground">
          <span className="mr-2 text-[10px] text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
          {label}
        </td>
      </tr>
    );
  };

  const EriCuentaRow = ({ row, idx }: { row: PlanPygRow; idx: number }) => {
    const vals = getCCVals(row.orden);
    const consVal = getConsolidado(vals);
    const allZero = CC_KEYS.every(cc => (vals[cc.key] ?? 0) === 0) && consVal === 0;
    if (allZero) return null;
    const isOpen = openIngreso.has(row.orden);
    const ccTercMap = ingresoTercerosMap.get(row.orden);
    return (
      <Fragment key={row.orden}>
        <tr
          className={`border-b border-border/20 cursor-pointer hover:opacity-90 ${idx % 2 === 0 ? "bg-background/10" : ""}`}
          onClick={() => toggleIngreso(row.orden)}
        >
          <td className="px-3 py-1 pl-8 text-[11px] text-muted-foreground">
            <span className="mr-2 text-[10px] text-muted-foreground/50">{isOpen ? "▾" : "▸"}</span>
            {row.etiqueta_fila || row.concepto}
          </td>
          {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(vals, cc)}{renderCCPct(vals, cc)}</Fragment>)}
          {renderConsCell(vals)}
          {renderConsPct(vals)}
        </tr>
        {isOpen && CC_KEYS.map(cc => {
          const tercMap = ccTercMap?.get(cc.key);
          if (!tercMap) return null;
          return Array.from(tercMap.entries())
            .filter(([, v]) => v !== 0)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([nombre, val], ti) => {
              const f = formatCell(val);
              return (
                <tr key={`${row.orden}||${cc.key}||${ti}`}
                    className="border-b border-border/10"
                    style={{ background: "#080c18" }}>
                  <td className="px-3 py-0.5 pl-16 text-[10px] text-muted-foreground/60">
                    <span className="mr-2 text-[9px] bg-muted/40 px-1 rounded font-mono">{cc.key}</span>
                    {nombre}
                  </td>
                  {CC_KEYS.map(c => {
                    const v = c.key === cc.key ? val : 0;
                    const fv = formatCell(v);
                    return (
                      <Fragment key={c.key}>
                        <td className={`px-2 py-0.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[110px] ${fv.zero ? 'text-muted-foreground/20' : fv.negative ? 'text-destructive' : 'text-muted-foreground/60'}`}>{fv.text}</td>
                        <td className="px-2 py-0.5 min-w-[55px]" />
                      </Fragment>
                    );
                  })}
                  <td className={`px-2 py-0.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[110px] ${f.negative ? 'text-destructive' : 'text-muted-foreground/60'}`}>{f.text}</td>
                  <td className="px-2 py-0.5 min-w-[60px]" />
                </tr>
              );
            });
        })}
      </Fragment>
    );
  };

  const TotalRow = ({ label, vals }: { label: string; vals: ValoresPorCC }) => (
    <tr className="border-b border-border" style={{ background: getConsolidado(vals) >= 0 ? "#1a2d1a" : "#2d1a1a" }}>
      <td className="px-3 py-1.5 text-[11px] font-bold text-foreground">{label}</td>
      {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(vals, cc, true)}{renderCCPct(vals, cc, true)}</Fragment>)}
      {renderConsCell(vals, true)}
      {renderConsPct(vals, true)}
    </tr>
  );

  const SubtotalRow = ({ label, vals }: { label: string; vals: ValoresPorCC }) => (
    <tr className="border-b border-border border-l-2 border-l-primary" style={{ background: "#0d2040" }}>
      <td className="px-3 py-2 text-[12px] font-bold text-foreground">{label}</td>
      {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(vals, cc, true)}{renderCCPct(vals, cc, true)}</Fragment>)}
      {renderConsCell(vals, true)}
      {renderConsPct(vals, true)}
    </tr>
  );

  const renderGastosTree = (n1: Nivel1CC) => {
    const k1 = n1.tipo_gasto;
    const isOpen1 = openN1.has(k1);
    return (
      <Fragment key={k1}>
        <tr
          className="cursor-pointer border-b border-border/40 hover:opacity-90"
          style={{ background: "#151f33" }}
          onClick={() => toggleN1(k1)}
        >
          <td className="px-3 py-1.5 pl-5 text-[11px] font-semibold text-foreground">
            <span className="mr-2 text-[10px] text-muted-foreground">{isOpen1 ? "▼" : "▶"}</span>
            {n1.tipo_gasto}
          </td>
          {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(n1.valores, cc, true)}{renderCCPct(n1.valores, cc, true)}</Fragment>)}
          {renderConsCell(n1.valores, true)}
          {renderConsPct(n1.valores, true)}
        </tr>
        {isOpen1 && n1.detalles.map((n2) => {
          const k2 = `${k1}||${n2.detalle_gasto}`;
          const isOpen2 = openN2.has(k2);
          if (getConsolidado(n2.valores) === 0) return null;
          return (
            <Fragment key={k2}>
              <tr
                className="cursor-pointer border-b border-border/30 hover:opacity-90"
                style={{ background: "#0d1525" }}
                onClick={() => toggleN2(k2)}
              >
                <td className="px-3 py-1.5 pl-10 text-[11px] text-muted-foreground">
                  <span className="mr-2 text-[10px] text-muted-foreground/60">{isOpen2 ? "▾" : "▸"}</span>
                  {n2.detalle_gasto}
                </td>
                {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(n2.valores, cc)}{renderCCPct(n2.valores, cc)}</Fragment>)}
                {renderConsCell(n2.valores)}
                {renderConsPct(n2.valores)}
              </tr>
              {isOpen2 && n2.cuentas.map((n3) => {
                const k3 = `${k2}||${n3.nombre_cuenta}`;
                const isOpen3 = openN3.has(k3);
                if (getConsolidado(n3.valores) === 0) return null;
                return (
                  <Fragment key={k3}>
                    <tr
                      className="cursor-pointer border-b border-border/10 hover:opacity-80"
                      onClick={() => toggleN3(k3)}
                    >
                      <td className="px-3 py-1 pl-16 text-[11px] text-muted-foreground/80">
                        <span className="mr-2 text-[10px] text-muted-foreground/40">{isOpen3 ? "▾" : "▸"}</span>
                        {n3.nombre_cuenta}
                      </td>
                      {CC_KEYS.map((cc) => <Fragment key={cc.key}>{renderCellVal(n3.valores, cc)}{renderCCPct(n3.valores, cc)}</Fragment>)}
                      {renderConsCell(n3.valores)}
                      {renderConsPct(n3.valores)}
                    </tr>
                    {isOpen3 && n3.terceros.map((t, ti) => {
                      const consT = getConsolidado(t.valores);
                      const fConsT = formatCell(consT);
                      return (
                        <tr key={`${k3}||${t.nit}||${ti}`} className="border-b border-border/10" style={{ background: "#080c18" }}>
                          <td className="px-3 py-0.5 pl-20">
                            <div className="flex items-center gap-2">
                              {t.nit && t.nit !== "SIN TERCERO" && (
                                <span className="flex-shrink-0 rounded bg-muted/40 px-1 font-mono text-[9px] text-muted-foreground">{t.nit}</span>
                              )}
                              {(() => {
                                const activeCCs = CC_KEYS.filter(cc => (t.valores[cc.key] ?? 0) !== 0);
                                if (activeCCs.length === 1) return (
                                  <span className="flex-shrink-0 rounded bg-primary/20 px-1 font-mono text-[9px] text-primary/70">
                                    {activeCCs[0].label}
                                  </span>
                                );
                                return null;
                              })()}
                              <span className="text-[10px] text-muted-foreground/60">{t.tercero}</span>
                            </div>
                          </td>
                          {CC_KEYS.map((cc) => {
                            const f = formatCell(t.valores[cc.key] ?? 0);
                            return (
                              <Fragment key={cc.key}>
                                <td className={`${colClass} text-[10px] ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/20" : "text-muted-foreground/50"}`}>{f.text}</td>
                                <td className="px-2 py-0.5 min-w-[55px]" />
                              </Fragment>
                            );
                          })}
                          <td className={`${colClass} text-[10px] ${fConsT.negative ? "text-destructive" : "text-muted-foreground/50"}`}>{fConsT.text}</td>
                          <td className="px-2 py-0.5 min-w-[60px]" />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </Fragment>
    );
  };

  const isLoading = plan.isLoading || gastos.isLoading || eriCC.isLoading;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Mes:</span>
          {mesesDisponibles.map((m) => (
            <button
              key={String(m.value)}
              onClick={() => setMesLocal(m.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mesLocal === m.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Expandir todo</button>
          <button onClick={collapseAll} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Contraer todo</button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">{Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/40" />
        ))}</div>
      ) : gastos.isError || eriCC.isError || plan.isError ? (
        <ErrorState />
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[240px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Concepto</th>
                {CC_KEYS.map((cc) => (
                  <Fragment key={cc.key}>
                    <th className="min-w-[110px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cc.label}
                    </th>
                    <th className="min-w-[55px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">%</th>
                  </Fragment>
                ))}
                <th className="min-w-[120px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-primary">Consolidado</th>
                <th className="min-w-[60px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">%</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader label="INGRESOS OPERACIONALES" sectionKey="ingresos" />
              {openSections.has('ingresos') && ingresosCuentas.map((row, i) => <EriCuentaRow key={row.orden} row={row} idx={i} />)}
              {openSections.has('ingresos') && <TotalRow label="TOTAL INGRESOS OPERACIONALES" vals={vTotalIngresos} />}

              <SectionHeader label="COSTOS DE VENTAS" sectionKey="costos" />
              {openSections.has('costos') && costosCuentas.map((row, i) => <EriCuentaRow key={row.orden} row={row} idx={i} />)}
              {openSections.has('costos') && <TotalRow label="TOTAL COSTOS" vals={vTotalCostos} />}

              <SubtotalRow label="UTILIDAD BRUTA" vals={vUtilidadBruta} />

              <SectionHeader label="GASTOS OPERACIONALES" sectionKey="gastos-oper" />
              {openSections.has('gastos-oper') && gastosOperTree && renderGastosTree(gastosOperTree)}

              <SubtotalRow label="UTILIDAD OPERACIONAL" vals={vUtilidadOper} />

              <SectionHeader label="OTROS INGRESOS" sectionKey="otros-ingresos" />
              {openSections.has('otros-ingresos') && otrosIngresosCuentas.map((row, i) => <EriCuentaRow key={row.orden} row={row} idx={i} />)}
              {openSections.has('otros-ingresos') && <TotalRow label="TOTAL OTROS INGRESOS" vals={vOtrosIngresos} />}

              <SectionHeader label="OTROS GASTOS" sectionKey="otros-gastos" />
              {openSections.has('otros-gastos') && gastosNoOperTree && renderGastosTree(gastosNoOperTree)}

              <SubtotalRow label="UTILIDAD ANTES DE IMPUESTOS" vals={vUtilidadAI} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabMesAMes({ plan, filtros }: TabProps) {
  const [ccActivo, setCcActivo] = useState("TODOS");
  const eriAll = useEriAllMonths({ año: filtros.año, compania: filtros.compania, ccKey: ccActivo });

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['ingresos','costos','gastos','otros-ingresos','otros-gastos'])
  );
  const [openTercero, setOpenTercero] = useState<Set<number>>(new Set());

  const toggleSection = (k: string) =>
    setOpenSections(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });
  const toggleTercero = (orden: number) =>
    setOpenTercero(prev => { const s = new Set(prev); s.has(orden) ? s.delete(orden) : s.add(orden); return s; });

  const { planRows, valueMap, months } = useMemo(() => {
    const planRows: PlanPygRow[] = plan.data ?? [];
    const map = new Map<number, Map<number, number>>();
    const monthSet = new Set<number>();
    for (const r of eriAll.data ?? []) {
      monthSet.add(r.año_mes_num);
      let inner = map.get(r.orden);
      if (!inner) { inner = new Map(); map.set(r.orden, inner); }
      inner.set(r.año_mes_num, (inner.get(r.año_mes_num) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    const months = Array.from(monthSet).sort((a, b) => a - b);
    return { planRows, valueMap: map, months };
  }, [plan.data, eriAll.data]);

  const terceroMap = useMemo(() => {
    const map = new Map<number, Map<number, Map<string, number>>>();
    for (const r of eriAll.data ?? []) {
      if (!map.has(r.orden)) map.set(r.orden, new Map());
      const mesMap = map.get(r.orden)!;
      if (!mesMap.has(r.año_mes_num)) mesMap.set(r.año_mes_num, new Map());
      const nombre = ((r as any).concepto ?? '').replace(/\d+$/, '').trim() || 'Sin detalle';
      const tercMap = mesMap.get(r.año_mes_num)!;
      tercMap.set(nombre, (tercMap.get(nombre) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return map;
  }, [eriAll.data]);

  const sumOrdens = (ordenes: number[]) => {
    const result = new Map<number, number>();
    for (const orden of ordenes) {
      const inner = valueMap.get(orden);
      if (!inner) continue;
      for (const [mes, v] of inner.entries()) result.set(mes, (result.get(mes) ?? 0) + v);
    }
    return result;
  };

  const ingresoRows = planRows.filter(r => r.nivel === 'Cuenta' && (r as any).clase_cod === '4' && (r as any).grupo_cod === '41');
  const costosRows = planRows.filter(r => r.nivel === 'Cuenta' && (r as any).clase_cod === '6');
  const gastosRows = planRows.filter(r => r.nivel === 'Cuenta' && (r as any).clase_cod === '5');
  const otrosIngRows = planRows.filter(r => r.nivel === 'Cuenta' && (r as any).clase_cod === '4' && (r as any).grupo_cod === '42');

  const mapTotalIngresos = useMemo(() => sumOrdens(ingresoRows.map(r => r.orden)), [valueMap, ingresoRows]);
  const mapTotalCostos = useMemo(() => sumOrdens(costosRows.map(r => r.orden)), [valueMap, costosRows]);
  const mapTotalGastos = useMemo(() => sumOrdens(gastosRows.map(r => r.orden)), [valueMap, gastosRows]);
  const mapOtrosIngresos = useMemo(() => sumOrdens(otrosIngRows.map(r => r.orden)), [valueMap, otrosIngRows]);

  const mapUtilBruta = useMemo(() => {
    const result = new Map<number, number>();
    for (const mes of months) {
      result.set(mes, (mapTotalIngresos.get(mes) ?? 0) + (mapTotalCostos.get(mes) ?? 0));
    }
    return result;
  }, [mapTotalIngresos, mapTotalCostos, months]);

  const mapUtilOper = useMemo(() => {
    const result = new Map<number, number>();
    for (const mes of months) {
      result.set(mes, (mapUtilBruta.get(mes) ?? 0) - (mapTotalGastos.get(mes) ?? 0));
    }
    return result;
  }, [mapUtilBruta, mapTotalGastos, months]);

  const mapUtilNeta = useMemo(() => {
    const result = new Map<number, number>();
    for (const mes of months) {
      result.set(mes, (mapUtilOper.get(mes) ?? 0) + (mapOtrosIngresos.get(mes) ?? 0));
    }
    return result;
  }, [mapUtilOper, mapOtrosIngresos, months]);

  const totalIngresosAcum = useMemo(() =>
    months.reduce((s, m) => s + (mapTotalIngresos.get(m) ?? 0), 0) || 1,
    [mapTotalIngresos, months]);

  const isLoading = plan.isLoading || eriAll.isLoading;
  const isError = plan.isError || eriAll.isError;
  const colClass = "whitespace-nowrap px-3 py-1.5 text-right tabular-nums";

  const renderCuentaRow = (row: PlanPygRow, idx: number) => {
    const inner = valueMap.get(row.orden);
    const monthValues = months.map(m => inner?.get(m) ?? 0);
    const total = monthValues.reduce((s, v) => s + v, 0);
    if (total === 0 && monthValues.every(v => v === 0)) return null;
    const isOpen = openTercero.has(row.orden);
    const hasTerceros = terceroMap.has(row.orden);
    const pct = total !== 0 ? (total / totalIngresosAcum) * 100 : null;
    return (
      <Fragment key={row.orden}>
        <tr
          className={`border-b border-border/30 cursor-pointer hover:opacity-90 ${idx % 2 === 0 ? 'bg-background/20' : ''}`}
          onClick={() => hasTerceros && toggleTercero(row.orden)}
        >
          <td className="px-3 py-1 pl-8 text-[11px] text-muted-foreground">
            {hasTerceros && <span className="mr-2 text-[10px] text-muted-foreground/50">{isOpen ? '▾' : '▸'}</span>}
            {row.etiqueta_fila || row.concepto}
          </td>
          {monthValues.map((v, i) => {
            const f = formatCell(v);
            return <td key={i} className={`${colClass} text-[11px] ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : 'text-foreground'}`}>{f.text}</td>;
          })}
          {(() => { const f = formatCell(total); return <td className={`${colClass} text-[11px] font-semibold text-primary ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : ''}`}>{f.text}</td>; })()}
          <td className="whitespace-nowrap px-3 py-1 text-right text-[10px] tabular-nums text-muted-foreground/70">
            {pct != null ? `${pct.toFixed(2)}%` : '-'}
          </td>
        </tr>
        {isOpen && months.map(mes => {
          const tercMesMap = terceroMap.get(row.orden)?.get(mes);
          if (!tercMesMap) return null;
          return Array.from(tercMesMap.entries())
            .filter(([, v]) => v !== 0)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([nombre, val], ti) => {
              const f = formatCell(val);
              return (
                <tr key={`${row.orden}||${mes}||${ti}`} className="border-b border-border/10" style={{ background: '#080c18' }}>
                  <td className="px-3 py-0.5 pl-16 text-[10px] text-muted-foreground/60">
                    <span className="mr-2 text-[9px] bg-muted/40 px-1 rounded font-mono">{mesLabel(mes)}</span>
                    {nombre}
                  </td>
                  {months.map(m => {
                    const v = m === mes ? val : 0;
                    const fv = formatCell(v);
                    return <td key={m} className={`${colClass} text-[10px] ${fv.zero ? 'text-muted-foreground/20' : fv.negative ? 'text-destructive' : 'text-muted-foreground/50'}`}>{fv.text}</td>;
                  })}
                  <td className={`${colClass} text-[10px] ${f.negative ? 'text-destructive' : 'text-muted-foreground/50'}`}>{f.text}</td>
                  <td className="px-3 py-0.5 text-right text-[10px] text-muted-foreground/20">-</td>
                </tr>
              );
            });
        })}
      </Fragment>
    );
  };

  const SubtotalRowM = ({ label, dataMap, highlight = false }: { label: string; dataMap: Map<number, number>; highlight?: boolean }) => {
    const monthValues = months.map(m => dataMap.get(m) ?? 0);
    const total = monthValues.reduce((s, v) => s + v, 0);
    const pct = total !== 0 ? (total / totalIngresosAcum) * 100 : null;
    const bg = highlight ? '#0d2040' : total >= 0 ? '#1a2d1a' : '#2d1a1a';
    return (
      <tr className="border-b border-border border-l-2 border-l-primary font-bold" style={{ background: bg }}>
        <td className="px-3 py-2 text-[12px] font-bold text-foreground">{label}</td>
        {monthValues.map((v, i) => {
          const f = formatCell(v);
          return <td key={i} className={`${colClass} font-bold ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : 'text-foreground'}`}>{f.text}</td>;
        })}
        {(() => { const f = formatCell(total); return <td className={`${colClass} font-bold ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : 'text-primary'}`}>{f.text}</td>; })()}
        <td className="whitespace-nowrap px-3 py-2 text-right text-[10px] tabular-nums font-bold text-muted-foreground/70">
          {pct != null ? `${pct.toFixed(2)}%` : '-'}
        </td>
      </tr>
    );
  };

  const TotalRowM = ({ label, dataMap }: { label: string; dataMap: Map<number, number> }) => {
    const monthValues = months.map(m => dataMap.get(m) ?? 0);
    const total = monthValues.reduce((s, v) => s + v, 0);
    const pct = total !== 0 ? (total / totalIngresosAcum) * 100 : null;
    return (
      <tr className="border-b border-border font-bold" style={{ background: total >= 0 ? '#1a2d1a' : '#2d1a1a' }}>
        <td className="px-3 py-1.5 text-[11px] font-bold text-foreground">{label}</td>
        {monthValues.map((v, i) => {
          const f = formatCell(v);
          return <td key={i} className={`${colClass} font-bold ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : 'text-foreground'}`}>{f.text}</td>;
        })}
        {(() => { const f = formatCell(total); return <td className={`${colClass} font-bold ${f.negative ? 'text-destructive' : f.zero ? 'text-muted-foreground/30' : 'text-foreground'}`}>{f.text}</td>; })()}
        <td className="whitespace-nowrap px-3 py-1.5 text-right text-[10px] tabular-nums font-bold text-muted-foreground/70">
          {pct != null ? `${pct.toFixed(2)}%` : '-'}
        </td>
      </tr>
    );
  };

  const SectionHeader = ({ label, sectionKey }: { label: string; sectionKey: string }) => {
    const isOpen = openSections.has(sectionKey);
    return (
      <tr style={{ background: '#1e2d42' }} className="cursor-pointer hover:opacity-90"
          onClick={() => toggleSection(sectionKey)}>
        <td colSpan={months.length + 3} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground">
          <span className="mr-2 text-[10px] text-muted-foreground">{isOpen ? '▼' : '▶'}</span>
          {label}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CcPills value={ccActivo} onChange={setCcActivo} />
        <div className="flex gap-2">
          <button onClick={() => setOpenSections(new Set(['ingresos','costos','gastos','otros-ingresos','otros-gastos']))}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Expandir todo
          </button>
          <button onClick={() => setOpenSections(new Set())}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Contraer todo
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 12 }).map((_, i) => <LoadingSkeleton key={i} className="h-7 w-full" />)}</div>
      ) : isError ? <ErrorState />
      : planRows.length === 0 || months.length === 0 ? <EmptyState />
      : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concepto</th>
                {months.map(m => (
                  <th key={m} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{mesLabel(m)}</th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-primary">Acumulado</th>
                <th className="min-w-[70px] whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">% Vert.</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader label="INGRESOS OPERACIONALES" sectionKey="ingresos" />
              {openSections.has('ingresos') && ingresoRows.map((r, i) => renderCuentaRow(r, i))}
              <TotalRowM label="TOTAL INGRESOS OPERACIONALES" dataMap={mapTotalIngresos} />

              <SectionHeader label="COSTOS DE VENTAS" sectionKey="costos" />
              {openSections.has('costos') && costosRows.map((r, i) => renderCuentaRow(r, i))}
              <TotalRowM label="TOTAL COSTOS" dataMap={mapTotalCostos} />

              <SubtotalRowM label="UTILIDAD BRUTA" dataMap={mapUtilBruta} highlight />

              <SectionHeader label="GASTOS OPERACIONALES" sectionKey="gastos" />
              {openSections.has('gastos') && gastosRows.map((r, i) => renderCuentaRow(r, i))}
              <TotalRowM label="TOTAL GASTOS OPERACIONALES" dataMap={mapTotalGastos} />

              <SubtotalRowM label="UTILIDAD OPERACIONAL" dataMap={mapUtilOper} highlight />

              <SectionHeader label="OTROS INGRESOS" sectionKey="otros-ingresos" />
              {openSections.has('otros-ingresos') && otrosIngRows.map((r, i) => renderCuentaRow(r, i))}
              <TotalRowM label="TOTAL OTROS INGRESOS" dataMap={mapOtrosIngresos} />

              <SubtotalRowM label="UTILIDAD NETA" dataMap={mapUtilNeta} highlight />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

