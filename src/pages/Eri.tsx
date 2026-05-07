import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useFiltros } from "@/context/FiltrosContext";
import {
  useEri,
  usePlanPyg,
  useEriAllMonths,
  useEriAllCC,
  useGastosTercero,
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

type TabId = "periodo" | "mes-a-mes" | "por-cc" | "detalle-tercero";

export default function Eri() {
  const filtros = useFiltros();
  const plan = usePlanPyg();
  const [activeTab, setActiveTab] = useState<TabId>("periodo");

  const tabs: { id: TabId; label: string }[] = [
    { id: "periodo", label: "Período" },
    { id: "mes-a-mes", label: "Mes a mes" },
    { id: "por-cc", label: "Por centro de costo" },
    { id: "detalle-tercero", label: "Detalle por Tercero" },
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
      {activeTab === "detalle-tercero" && <TabDetalleTercero filtros={filtros} />}
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