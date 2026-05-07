import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useFiltros } from "@/context/FiltrosContext";
import {
  useEri,
  usePlanPyg,
  useEriAllMonths,
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
      {activeTab === "por-cc" && <TabPorCC filtros={filtros} />}
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
                          {pct != null ? `${pct.toFixed(1)}%` : ""}
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
    n3.terceros.push({ tercero, nit, valores });
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

function TabPorCC({ filtros }: { filtros: FiltroDashboard }) {
  const [mesLocal, setMesLocal] = useState<number | "Todos">("Todos");
  const gastos = useGastosPorCC({
    año: filtros.año,
    mes: mesLocal,
    compania: filtros.compania,
  });
  const tree = useMemo(() => buildTreeCC(gastos.data ?? []), [gastos.data]);

  const [openN1, setOpenN1] = useState<Set<string>>(new Set());
  const [openN2, setOpenN2] = useState<Set<string>>(new Set());
  const [openN3, setOpenN3] = useState<Set<string>>(new Set());

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
    setOpenN1(new Set(tree.map((n) => n.tipo_gasto)));
    setOpenN2(new Set(tree.flatMap((n) => n.detalles.map((d) => `${n.tipo_gasto}||${d.detalle_gasto}`))));
    setOpenN3(new Set(tree.flatMap((n) => n.detalles.flatMap((d) =>
      d.cuentas.map((c) => `${n.tipo_gasto}||${d.detalle_gasto}||${c.nombre_cuenta}`)
    ))));
  };
  const collapseAll = () => { setOpenN1(new Set()); setOpenN2(new Set()); setOpenN3(new Set()); };

  const getConsolidado = (vals: ValoresPorCC) =>
    CC_KEYS.reduce((s, cc) => s + (vals[cc.key] ?? 0), 0);

  const totalConsolidado = tree.reduce((s, n) => s + getConsolidado(n.valores), 0);

  const año = filtros.año === "Todas" ? 2026 : Number(filtros.año);
  const mesesDisponibles: { value: number | "Todos"; label: string }[] = [
    { value: "Todos", label: "Acumulado" },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
      value: año * 100 + m,
      label: mesLabel(año * 100 + m),
    })),
  ];

  const colClass = "px-2 py-1.5 text-right text-[11px] tabular-nums whitespace-nowrap";

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

      {gastos.isLoading ? (
        <div className="space-y-1">{Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/40" />
        ))}</div>
      ) : gastos.isError ? (
        <ErrorState />
      ) : tree.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Sin datos para los filtros seleccionados</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[240px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Concepto</th>
                {CC_KEYS.map((cc) => (
                  <th key={cc.key} className="min-w-[110px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cc.label}
                  </th>
                ))}
                <th className="min-w-[120px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-primary">Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((n1) => {
                const k1 = n1.tipo_gasto;
                const isOpen1 = openN1.has(k1);
                const cons1 = getConsolidado(n1.valores);
                const fCons1 = formatCell(cons1);
                return (
                  <Fragment key={k1}>
                    <tr
                      className="cursor-pointer border-b border-border/40 hover:opacity-90"
                      style={{ background: "#1e2d42" }}
                      onClick={() => toggleN1(k1)}
                    >
                      <td className="px-3 py-2 font-bold text-foreground">
                        <span className="mr-2 text-muted-foreground">{isOpen1 ? "▼" : "▶"}</span>
                        {n1.tipo_gasto}
                      </td>
                      {CC_KEYS.map((cc) => {
                        const f = formatCell(n1.valores[cc.key] ?? 0);
                        return (
                          <td key={cc.key} className={`${colClass} font-bold ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/40" : "text-foreground"}`}>{f.text}</td>
                        );
                      })}
                      <td className={`${colClass} font-bold ${fCons1.negative ? "text-destructive" : "text-foreground"}`}>{fCons1.text}</td>
                    </tr>
                    {isOpen1 && n1.detalles.map((n2) => {
                      const k2 = `${k1}||${n2.detalle_gasto}`;
                      const isOpen2 = openN2.has(k2);
                      const cons2 = getConsolidado(n2.valores);
                      const fCons2 = formatCell(cons2);
                      return (
                        <Fragment key={k2}>
                          <tr
                            className="cursor-pointer border-b border-border/30 hover:opacity-90"
                            style={{ background: "#151f33" }}
                            onClick={() => toggleN2(k2)}
                          >
                            <td className="px-3 py-1.5 pl-8 font-semibold text-foreground">
                              <span className="mr-2 text-muted-foreground">{isOpen2 ? "▼" : "▶"}</span>
                              {n2.detalle_gasto}
                            </td>
                            {CC_KEYS.map((cc) => {
                              const f = formatCell(n2.valores[cc.key] ?? 0);
                              return (
                                <td key={cc.key} className={`${colClass} font-semibold ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/40" : "text-foreground"}`}>{f.text}</td>
                              );
                            })}
                            <td className={`${colClass} font-semibold ${fCons2.negative ? "text-destructive" : "text-foreground"}`}>{fCons2.text}</td>
                          </tr>
                          {isOpen2 && n2.cuentas.map((n3) => {
                            const k3 = `${k2}||${n3.nombre_cuenta}`;
                            const isOpen3 = openN3.has(k3);
                            const cons3 = getConsolidado(n3.valores);
                            const fCons3 = formatCell(cons3);
                            return (
                              <Fragment key={k3}>
                                <tr
                                  className="cursor-pointer border-b border-border/20 hover:opacity-80"
                                  onClick={() => toggleN3(k3)}
                                >
                                  <td className="px-3 py-1.5 pl-14 text-muted-foreground">
                                    <span className="mr-2 text-muted-foreground/60">{isOpen3 ? "▾" : "▸"}</span>
                                    {n3.nombre_cuenta}
                                  </td>
                                  {CC_KEYS.map((cc) => {
                                    const f = formatCell(n3.valores[cc.key] ?? 0);
                                    return (
                                      <td key={cc.key} className={`${colClass} ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-muted-foreground"}`}>{f.text}</td>
                                    );
                                  })}
                                  <td className={`${colClass} ${fCons3.negative ? "text-destructive" : "text-muted-foreground"}`}>{fCons3.text}</td>
                                </tr>
                                {isOpen3 && n3.terceros.map((t, ti) => {
                                  const consT = getConsolidado(t.valores);
                                  const fConsT = formatCell(consT);
                                  return (
                                    <tr
                                      key={`${k3}||${t.nit}||${ti}`}
                                      className="border-b border-border/10"
                                      style={{ background: "#080c18" }}
                                    >
                                      <td className="px-3 py-1 pl-20">
                                        <div className="flex items-center gap-2">
                                          {t.nit && t.nit !== "SIN TERCERO" && (
                                            <span className="flex-shrink-0 rounded bg-muted/60 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">{t.nit}</span>
                                          )}
                                          <span className="text-[11px] text-muted-foreground/70">{t.tercero}</span>
                                        </div>
                                      </td>
                                      {CC_KEYS.map((cc) => {
                                        const f = formatCell(t.valores[cc.key] ?? 0);
                                        return (
                                          <td key={cc.key} className={`${colClass} ${f.negative ? "text-destructive" : f.zero ? "text-muted-foreground/20" : "text-muted-foreground/60"}`}>{f.text}</td>
                                        );
                                      })}
                                      <td className={`${colClass} ${fConsT.negative ? "text-destructive" : "text-muted-foreground/60"}`}>{fConsT.text}</td>
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
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-card">
                <td className="px-3 py-2 text-[11px] font-bold text-foreground">TOTAL GASTOS</td>
                {CC_KEYS.map((cc) => {
                  const total = tree.reduce((s, n) => s + (n.valores[cc.key] ?? 0), 0);
                  const f = formatCell(total);
                  return (
                    <td key={cc.key} className={`${colClass} font-bold ${f.negative ? "text-destructive" : "text-foreground"}`}>{f.text}</td>
                  );
                })}
                {(() => { const f = formatCell(totalConsolidado); return <td className={`${colClass} font-bold text-primary`}>{f.text}</td>; })()}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
  const [ccActivo, setCcActivo] = useState("TODOS");
  const gastos = useGastosTercero({
    año: filtros.año,
    mes: filtros.mes,
    compania: filtros.compania,
    ccKey: ccActivo,
  });

  const tree = useMemo(() => buildTree(gastos.data ?? []), [gastos.data]);

  const [openN1, setOpenN1] = useState<Set<string>>(new Set());
  const [openN2, setOpenN2] = useState<Set<string>>(new Set());
  const [openN3, setOpenN3] = useState<Set<string>>(new Set());

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
    setOpenN1(new Set(tree.map((n) => n.tipo_gasto)));
    setOpenN2(new Set(tree.flatMap((n) => n.detalles.map((d) => `${n.tipo_gasto}||${d.detalle_gasto}`))));
    setOpenN3(new Set(tree.flatMap((n) => n.detalles.flatMap((d) =>
      d.cuentas.map((c) => `${n.tipo_gasto}||${d.detalle_gasto}||${c.nombre_cuenta}`)
    ))));
  };
  const collapseAll = () => { setOpenN1(new Set()); setOpenN2(new Set()); setOpenN3(new Set()); };

  const totalGeneral = tree.reduce((s, n) => s + n.valor, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {CENTROS.map((cc) => (
            <button
              key={cc.key}
              onClick={() => setCcActivo(cc.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                ccActivo === cc.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cc.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Expandir todo</button>
          <button onClick={collapseAll} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Contraer todo</button>
        </div>
      </div>

      {gastos.isLoading ? (
        <div className="space-y-1">{Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/40" />
        ))}</div>
      ) : gastos.isError ? (
        <ErrorState />
      ) : tree.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Sin datos para los filtros seleccionados</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border bg-card px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Concepto</span>
            <span className="min-w-[120px] text-right">Valor</span>
          </div>
          <div className="divide-y divide-border/30">
            {tree.map((n1) => {
              const k1 = n1.tipo_gasto;
              const isOpen1 = openN1.has(k1);
              const fN1 = formatCell(n1.valor);
              return (
                <div key={k1}>
                  <div
                    className="grid cursor-pointer select-none grid-cols-[1fr_auto] gap-4 px-3 py-2 transition-colors hover:bg-muted/20"
                    style={{ background: "#1e2d42" }}
                    onClick={() => toggleN1(k1)}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold text-foreground">
                      <span className="w-3 flex-shrink-0 text-center text-muted-foreground">{isOpen1 ? "▼" : "▶"}</span>
                      {n1.tipo_gasto}
                    </div>
                    <div className={`min-w-[120px] text-right text-[11px] font-bold tabular-nums ${fN1.negative ? "text-destructive" : "text-foreground"}`}>{fN1.text}</div>
                  </div>
                  {isOpen1 && n1.detalles.map((n2) => {
                    const k2 = `${k1}||${n2.detalle_gasto}`;
                    const isOpen2 = openN2.has(k2);
                    const fN2 = formatCell(n2.valor);
                    return (
                      <div key={k2}>
                        <div
                          className="grid cursor-pointer select-none grid-cols-[1fr_auto] gap-4 px-3 py-1.5 transition-colors hover:bg-muted/20"
                          style={{ background: "#151f33" }}
                          onClick={() => toggleN2(k2)}
                        >
                          <div className="flex items-center gap-2 pl-5 text-[11px] font-semibold text-foreground">
                            <span className="w-3 flex-shrink-0 text-center text-muted-foreground">{isOpen2 ? "▼" : "▶"}</span>
                            {n2.detalle_gasto}
                          </div>
                          <div className={`min-w-[120px] text-right text-[11px] font-semibold tabular-nums ${fN2.negative ? "text-destructive" : "text-foreground"}`}>{fN2.text}</div>
                        </div>
                        {isOpen2 && n2.cuentas.map((n3) => {
                          const k3 = `${k2}||${n3.nombre_cuenta}`;
                          const isOpen3 = openN3.has(k3);
                          const fN3 = formatCell(n3.valor);
                          return (
                            <div key={k3}>
                              <div
                                className="grid cursor-pointer select-none grid-cols-[1fr_auto] gap-4 px-3 py-1.5 transition-colors hover:bg-muted/10"
                                onClick={() => toggleN3(k3)}
                              >
                                <div className="flex items-center gap-2 pl-10 text-[11px] text-muted-foreground">
                                  <span className="w-3 flex-shrink-0 text-center text-muted-foreground/60">{isOpen3 ? "▾" : "▸"}</span>
                                  {n3.nombre_cuenta}
                                </div>
                                <div className={`min-w-[120px] text-right text-[11px] tabular-nums ${fN3.negative ? "text-destructive" : "text-muted-foreground"}`}>{fN3.text}</div>
                              </div>
                              {isOpen3 && n3.terceros.map((t, ti) => {
                                const fT = formatCell(t.valor);
                                return (
                                  <div
                                    key={`${k3}||${t.nit}||${ti}`}
                                    className="grid grid-cols-[1fr_auto] gap-4 border-b border-border/20 px-3 py-1 last:border-0"
                                    style={{ background: "#080c18" }}
                                  >
                                    <div className="flex items-center gap-3 pl-16">
                                      {t.nit && t.nit !== "SIN TERCERO" && (
                                        <span className="flex-shrink-0 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{t.nit}</span>
                                      )}
                                      <span className="text-[11px] text-muted-foreground/80">{t.tercero}</span>
                                    </div>
                                    <div className={`min-w-[120px] text-right text-[11px] tabular-nums ${fT.negative ? "text-destructive" : "text-muted-foreground/70"}`}>{fT.text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-border bg-card px-3 py-2">
            <span className="text-[11px] font-bold text-foreground">TOTAL GASTOS</span>
            <span className={`min-w-[120px] text-right text-[11px] font-bold tabular-nums ${totalGeneral < 0 ? "text-destructive" : "text-foreground"}`}>{formatCell(totalGeneral).text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TabMesAMes({ plan, filtros }: TabProps) {
  const [ccActivo, setCcActivo] = useState("TODOS");
  const eriAll = useEriAllMonths({
    año: filtros.año,
    compania: filtros.compania,
    ccKey: ccActivo,
  });

  const { planRows, valueMap, months } = useMemo(() => {
    const planRows: PlanPygRow[] = plan.data ?? [];
    const map = new Map<number, Map<number, number>>();
    const monthSet = new Set<number>();
    for (const r of eriAll.data ?? []) {
      monthSet.add(r.año_mes_num);
      let inner = map.get(r.orden);
      if (!inner) {
        inner = new Map();
        map.set(r.orden, inner);
      }
      inner.set(r.año_mes_num, (inner.get(r.año_mes_num) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    const months = Array.from(monthSet).sort((a, b) => a - b);
    return { planRows, valueMap: map, months };
  }, [plan.data, eriAll.data]);

  const isLoading = plan.isLoading || eriAll.isLoading;
  const isError = plan.isError || eriAll.isError;

  return (
    <div>
      <CcPills value={ccActivo} onChange={setCcActivo} />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState />
      ) : planRows.length === 0 || months.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {mesLabel(m)}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-primary">
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row, idx) => {
                const inner = valueMap.get(row.orden);
                const monthValues = months.map((m) => inner?.get(m) ?? 0);
                const total = monthValues.reduce((s, v) => s + v, 0);
                const { rowStyle, rowClass, isTitulo } = rowStyling(row.nivel, total, idx);
                return (
                  <tr key={row.orden} className={rowClass} style={rowStyle}>
                    <td className="px-3 py-1.5 text-foreground">
                      {row.etiqueta_fila || row.concepto}
                    </td>
                    {isTitulo
                      ? months.map((m) => <td key={m} className="px-3 py-1.5" />)
                      : monthValues.map((v, i) => {
                          const f = formatCell(v);
                          return (
                            <td
                              key={i}
                              className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                                f.negative
                                  ? "text-destructive"
                                  : f.zero
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {f.text}
                            </td>
                          );
                        })}
                    {isTitulo ? (
                      <td className="px-3 py-1.5" />
                    ) : (
                      (() => {
                        const f = formatCell(total);
                        return (
                          <td
                            className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums ${
                              f.negative
                                ? "text-destructive"
                                : f.zero
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {f.text}
                          </td>
                        );
                      })()
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

function TabPorCC({ plan, filtros }: TabProps) {
  const año = filtros.año === "Todas" ? 2026 : (filtros.año as number);
  const mesesDisponibles = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
        value: año * 100 + m,
        label: mesLabel(año * 100 + m),
      })),
    [año],
  );

  const [mesSeleccionado, setMesSeleccionado] = useState<number>(mesesDisponibles[0].value);

  const eriCC = useEriAllCC({
    año: filtros.año,
    compania: filtros.compania,
    mes: mesSeleccionado,
  });

  const centros = CENTROS.filter((c) => c.key !== "TODOS");

  const { planRows, valueMap } = useMemo(() => {
    const planRows: PlanPygRow[] = plan.data ?? [];
    const map = new Map<number, Map<string, number>>();
    for (const r of eriCC.data ?? []) {
      let inner = map.get(r.orden);
      if (!inner) {
        inner = new Map();
        map.set(r.orden, inner);
      }
      inner.set(r.cc_key, (inner.get(r.cc_key) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return { planRows, valueMap: map };
  }, [plan.data, eriCC.data]);

  const getConsolidado = (orden: number) => {
    const inner = valueMap.get(orden);
    if (!inner) return 0;
    return centros.reduce((s, cc) => s + (inner.get(cc.key) ?? 0), 0);
  };

  const ingresosTotalesConsolidado = Math.abs(getConsolidado(15)) || 1;

  const isLoading = plan.isLoading || eriCC.isLoading;
  const isError = plan.isError || eriCC.isError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Mes:</span>
        {mesesDisponibles.map((m) => (
          <button
            key={m.value}
            onClick={() => setMesSeleccionado(m.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mesSeleccionado === m.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

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
                <th className="min-w-[220px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                {centros.map((cc) => (
                  <th
                    key={cc.key}
                    className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {cc.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-primary">
                  Consolidado
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row, idx) => {
                const inner = valueMap.get(row.orden);
                const ccValues = centros.map((cc) => inner?.get(cc.key) ?? 0);
                const consolidado = getConsolidado(row.orden);
                const pct =
                  row.nivel !== "Titulo" && ingresosTotalesConsolidado !== 0
                    ? (consolidado / ingresosTotalesConsolidado) * 100
                    : null;
                const { rowStyle, rowClass, isTitulo } = rowStyling(row.nivel, consolidado, idx);
                return (
                  <tr key={row.orden} className={rowClass} style={rowStyle}>
                    <td className="px-3 py-1.5 text-foreground">
                      {row.etiqueta_fila || row.concepto}
                    </td>
                    {isTitulo
                      ? centros.map((cc) => <td key={cc.key} className="px-3 py-1.5" />)
                      : ccValues.map((v, i) => {
                          const f = formatCell(v);
                          return (
                            <td
                              key={i}
                              className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                                f.negative
                                  ? "text-destructive"
                                  : f.zero
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {f.text}
                            </td>
                          );
                        })}
                    {isTitulo ? (
                      <>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5" />
                      </>
                    ) : (
                      <>
                        {(() => {
                          const f = formatCell(consolidado);
                          return (
                            <td
                              className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums ${
                                f.negative
                                  ? "text-destructive"
                                  : f.zero
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {f.text}
                            </td>
                          );
                        })()}
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {pct != null ? `${pct.toFixed(1)}%` : ""}
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