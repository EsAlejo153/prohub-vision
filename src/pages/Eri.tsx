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
  type EriResumidaRow,
} from "@/hooks/useEri";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/dashboard/StateMessages";
import type { FiltroDashboard } from "@/types/financiero";

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(yyyymm: number) {
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  return `${MES_LABELS[m - 1] ?? m} ${String(y).slice(2)}`;
}

function fmtCell(v: number | null | undefined): { text: string; neg: boolean; zero: boolean } {
  if (v == null || !Number.isFinite(v) || v === 0) return { text: "-", neg: false, zero: true };
  if (v < 0)
    return { text: `(${Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 0 })})`, neg: true, zero: false };
  return { text: v.toLocaleString("es-CO", { maximumFractionDigits: 0 }), neg: false, zero: false };
}

const sumAll = (vals: Record<string, number>) => Object.values(vals).reduce((s, v) => s + v, 0);

const CC_KEYS = [
  { key: "01-PRINCIPAL", label: "Principal" },
  { key: "02-TIENDA CENTRO", label: "Tienda Centro" },
  { key: "03-DIGITAL", label: "Digital" },
  { key: "04-MONTERREY", label: "Monterrey" },
];

const CENTROS = [{ key: "TODOS", label: "Consolidado" }, ...CC_KEYS];

type TabId = "periodo" | "mes-a-mes" | "por-cc";

export default function Eri() {
  const filtros = useFiltros();
  const plan = usePlanPyg();
  const [activeTab, setActiveTab] = useState<TabId>("periodo");

  return (
    <AppLayout title="Estado de Resultados">
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["periodo", "mes-a-mes", "por-cc"] as TabId[]).map((id) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {id === "periodo" ? "Período" : id === "mes-a-mes" ? "Mes a mes" : "Por centro de costo"}
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
            value === cc.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {cc.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB PERÍODO
// ─────────────────────────────────────────────
function TabPeriodo({ plan, filtros }: TabProps) {
  const [ccActivo, setCcActivo] = useState("TODOS");
  const eri = useEri({ ...filtros, ccKey: ccActivo === "TODOS" ? "Todas" : ccActivo });

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
        : mesLabel((filtros.año as number) * 100 + (filtros.mes as number));

  const rowBg = (nivel: string) => {
    if (nivel === "Titulo") return "#1e2d42";
    if (nivel === "Total") return undefined;
    if (nivel === "Subtotal") return "#0d2040";
    return undefined;
  };

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
              {planRows.map((row) => {
                const val = valueMap.get(row.orden) ?? 0;
                const pct = row.nivel !== "Titulo" ? (val / ingresosTotales) * 100 : null;
                const f = fmtCell(val);
                const isTitulo = row.nivel === "Titulo";
                const isTotal = row.nivel === "Total";
                const isSubtotal = row.nivel === "Subtotal";
                const bg = rowBg(row.nivel);
                const bold = isTitulo || isTotal || isSubtotal;
                const dynamicBg = isTotal ? (val >= 0 ? "#1a2d1a" : "#2d1a1a") : bg;
                return (
                  <tr
                    key={row.orden}
                    className="border-b border-border/40"
                    style={{ background: dynamicBg, fontWeight: bold ? 700 : 400 }}
                  >
                    <td className="px-3 py-1.5 text-foreground">{row.etiqueta_fila || row.concepto}</td>
                    {isTitulo ? (
                      <>
                        <td />
                        <td />
                      </>
                    ) : (
                      <>
                        <td
                          className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                            f.neg ? "text-destructive" : f.zero ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {f.text}
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

// ─────────────────────────────────────────────
// TAB MES A MES
// ─────────────────────────────────────────────
function TabMesAMes({ plan, filtros }: TabProps) {
  const [ccActivo, setCcActivo] = useState("TODOS");

  const eriAll = useEriAllMonths({ año: filtros.año, compania: filtros.compania, ccKey: ccActivo });
  const gastosAll = useGastosPorCC({ año: filtros.año, mes: "Todos", compania: filtros.compania });

  const planRows: PlanPygRow[] = plan.data ?? [];

  const { valueMap, months } = useMemo(() => {
    const valueMap = new Map<number, Map<number, number>>();
    const monthSet = new Set<number>();
    for (const r of eriAll.data ?? []) {
      const mes = r.año_mes_num;
      if (!mes) continue;
      monthSet.add(mes);
      if (!valueMap.has(r.orden)) valueMap.set(r.orden, new Map());
      const inner = valueMap.get(r.orden)!;
      inner.set(mes, (inner.get(mes) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return { valueMap, months: Array.from(monthSet).sort((a, b) => a - b) };
  }, [eriAll.data]);

  const gastosOperPorMes = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of gastosAll.data ?? []) {
      if (r.tipo_gasto !== "01.GASTOS OPERACIONALES") continue;
      if (ccActivo !== "TODOS" && r.cc_key !== ccActivo) continue;
      m.set(r.año_mes_num, (m.get(r.año_mes_num) ?? 0) + (Number(r.gasto_real) || 0));
    }
    return m;
  }, [gastosAll.data, ccActivo]);

  const gastosNoOperPorMes = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of gastosAll.data ?? []) {
      if (r.tipo_gasto !== "02.GASTO NO OPERACIONAL") continue;
      if (ccActivo !== "TODOS" && r.cc_key !== ccActivo) continue;
      m.set(r.año_mes_num, (m.get(r.año_mes_num) ?? 0) + (Number(r.gasto_real) || 0));
    }
    return m;
  }, [gastosAll.data, ccActivo]);

  const getMonthVals = (orden: number) => months.map((m) => valueMap.get(orden)?.get(m) ?? 0);
  const getTotal = (orden: number) => getMonthVals(orden).reduce((s, v) => s + v, 0);

  const sub = useMemo(() => {
    const iCuentas = planRows.filter(
      (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "41",
    );
    const cCuentas = planRows.filter((r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "6");
    const oiCuentas = planRows.filter(
      (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "42",
    );

    const ingMes = months.map((m) => iCuentas.reduce((s, r) => s + (valueMap.get(r.orden)?.get(m) ?? 0), 0));
    const costMes = months.map((m) => cCuentas.reduce((s, r) => s + (valueMap.get(r.orden)?.get(m) ?? 0), 0));
    const ubMes = months.map((_, i) => ingMes[i] + costMes[i]);
    const gopMes = months.map((m) => gastosOperPorMes.get(m) ?? 0);
    const uoMes = months.map((_, i) => ubMes[i] - gopMes[i]);
    const oiMes = months.map((m) => oiCuentas.reduce((s, r) => s + (valueMap.get(r.orden)?.get(m) ?? 0), 0));
    const gnopMes = months.map((m) => gastosNoOperPorMes.get(m) ?? 0);
    const uaiMes = months.map((_, i) => uoMes[i] + oiMes[i] - gnopMes[i]);
    const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

    return {
      ingMes,
      ing: sum(ingMes),
      costMes,
      cost: sum(costMes),
      ubMes,
      ub: sum(ubMes),
      gopMes,
      gop: sum(gopMes),
      uoMes,
      uo: sum(uoMes),
      oiMes,
      oi: sum(oiMes),
      gnopMes,
      gnop: sum(gnopMes),
      uaiMes,
      uai: sum(uaiMes),
    };
  }, [planRows, valueMap, months, gastosOperPorMes, gastosNoOperPorMes]);

  const ingTot = Math.abs(sub.ing) || 1;
  const isLoading = plan.isLoading || eriAll.isLoading || gastosAll.isLoading;
  const isError = plan.isError || eriAll.isError || gastosAll.isError;

  const MC = ({ v, bold = false }: { v: number; bold?: boolean }) => {
    const f = fmtCell(v);
    return (
      <td
        className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-[11px] ${bold ? "font-bold" : ""} ${
          f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"
        }`}
      >
        {f.text}
      </td>
    );
  };

  const CuentaRow = ({ row }: { row: PlanPygRow }) => {
    const mVals = getMonthVals(row.orden);
    const tot = getTotal(row.orden);
    if (mVals.every((v) => v === 0) && tot === 0) return null;
    const f = fmtCell(tot);
    const pct = ingTot ? (tot / ingTot) * 100 : null;
    return (
      <tr className="border-b border-border/40 bg-background/20">
        <td className="px-3 py-1.5 pl-6 text-foreground text-[11px]">{row.etiqueta_fila || row.concepto}</td>
        {mVals.map((v, i) => (
          <MC key={i} v={v} />
        ))}
        <td
          className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-[11px] ${
            f.neg ? "text-destructive" : f.zero ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {f.text}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
          {pct != null && tot !== 0 ? `${pct.toFixed(2)}%` : "-"}
        </td>
      </tr>
    );
  };

  const TotalRow = ({ label, mv, tot }: { label: string; mv: number[]; tot: number }) => {
    const f = fmtCell(tot);
    const pct = ingTot ? (tot / ingTot) * 100 : null;
    return (
      <tr className="border-b border-border font-bold" style={{ background: tot >= 0 ? "#1a2d1a" : "#2d1a1a" }}>
        <td className="px-3 py-1.5 text-[11px] font-bold text-foreground">{label}</td>
        {mv.map((v, i) => (
          <MC key={i} v={v} bold />
        ))}
        <td
          className={`whitespace-nowrap px-3 py-1.5 text-right font-bold tabular-nums text-[11px] ${
            tot < 0 ? "text-destructive" : tot === 0 ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {f.text}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
          {pct != null && tot !== 0 ? `${pct.toFixed(2)}%` : "-"}
        </td>
      </tr>
    );
  };

  const SubRow = ({ label, mv, tot }: { label: string; mv: number[]; tot: number }) => {
    const f = fmtCell(tot);
    const pct = ingTot ? (tot / ingTot) * 100 : null;
    return (
      <tr className="border-b border-border border-l-2 border-l-primary font-bold" style={{ background: "#0d2040" }}>
        <td className="px-3 py-2 text-[12px] font-bold text-foreground">{label}</td>
        {mv.map((v, i) => (
          <MC key={i} v={v} bold />
        ))}
        <td
          className={`whitespace-nowrap px-3 py-1.5 text-right font-bold tabular-nums text-[11px] ${
            tot < 0 ? "text-destructive" : tot === 0 ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {f.text}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
          {pct != null && tot !== 0 ? `${pct.toFixed(2)}%` : "-"}
        </td>
      </tr>
    );
  };

  const SH = ({ label }: { label: string }) => (
    <tr style={{ background: "#1e2d42" }}>
      <td
        colSpan={months.length + 3}
        className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground"
      >
        {label}
      </td>
    </tr>
  );

  const ingCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "41",
  );
  const costCuentas = planRows.filter((r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "6");
  const gastCuentas = planRows.filter((r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "5");
  const oiCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "42",
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CcPills value={ccActivo} onChange={setCcActivo} />
      </div>
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
                <th className="min-w-[60px] whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  % Vert.
                </th>
              </tr>
            </thead>
            <tbody>
              <SH label="INGRESOS OPERACIONALES" />
              {ingCuentas.map((r) => (
                <CuentaRow key={r.orden} row={r} />
              ))}
              <TotalRow label="TOTAL INGRESOS OPERACIONALES" mv={sub.ingMes} tot={sub.ing} />
              <SH label="COSTOS DE VENTAS" />
              {costCuentas.map((r) => (
                <CuentaRow key={r.orden} row={r} />
              ))}
              <TotalRow label="TOTAL COSTOS" mv={sub.costMes} tot={sub.cost} />
              <SubRow label="UTILIDAD BRUTA" mv={sub.ubMes} tot={sub.ub} />
              <SH label="GASTOS OPERACIONALES" />
              {gastCuentas.map((r) => (
                <CuentaRow key={r.orden} row={r} />
              ))}
              <TotalRow label="TOTAL GASTOS OPERACIONALES" mv={sub.gopMes} tot={sub.gop} />
              <SubRow label="UTILIDAD OPERACIONAL" mv={sub.uoMes} tot={sub.uo} />
              <SH label="OTROS INGRESOS" />
              {oiCuentas.map((r) => (
                <CuentaRow key={r.orden} row={r} />
              ))}
              <TotalRow label="TOTAL OTROS INGRESOS" mv={sub.oiMes} tot={sub.oi} />
              <SH label="OTROS GASTOS" />
              <TotalRow label="TOTAL OTROS GASTOS" mv={sub.gnopMes} tot={sub.gnop} />
              <SubRow label="UTILIDAD ANTES DE IMPUESTOS" mv={sub.uaiMes} tot={sub.uai} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB POR CENTRO DE COSTO
// ─────────────────────────────────────────────
interface VCC {
  [cc: string]: number;
}
interface N4 {
  tercero: string;
  nit: string;
  valores: VCC;
}
interface N3 {
  nombre_cuenta: string;
  valores: VCC;
  terceros: N4[];
}
interface N2 {
  detalle_gasto: string;
  valores: VCC;
  cuentas: N3[];
}
interface N1 {
  tipo_gasto: string;
  valores: VCC;
  detalles: N2[];
}

function buildTree(rows: GastoTerceroRow[]): N1[] {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = `${r.tipo_gasto}||${r.detalle_gasto}||${r.nombre_cuenta}||${r.tercero_nombre}||${r.nit}`;
    if (!map.has(key)) map.set(key, new Map());
    map.get(key)!.set(r.cc_key, (map.get(key)!.get(r.cc_key) ?? 0) + (Number(r.gasto_real) || 0));
  }
  const n1Map = new Map<string, N1>();
  for (const [key, ccMap] of map.entries()) {
    const parts = key.split("||");
    const tipo = parts[0];
    const det = parts[1];
    const nom = parts[2];
    const terc = parts[3];
    const nit = parts[4];
    const vals: VCC = {};
    for (const [cc, v] of ccMap.entries()) vals[cc] = v;
    if (!n1Map.has(tipo)) n1Map.set(tipo, { tipo_gasto: tipo, valores: {}, detalles: [] });
    const n1 = n1Map.get(tipo)!;
    for (const [cc, v] of Object.entries(vals)) n1.valores[cc] = (n1.valores[cc] ?? 0) + v;
    let n2 = n1.detalles.find((d) => d.detalle_gasto === det);
    if (!n2) {
      n2 = { detalle_gasto: det, valores: {}, cuentas: [] };
      n1.detalles.push(n2);
    }
    for (const [cc, v] of Object.entries(vals)) n2.valores[cc] = (n2.valores[cc] ?? 0) + v;
    let n3 = n2.cuentas.find((c) => c.nombre_cuenta === nom);
    if (!n3) {
      n3 = { nombre_cuenta: nom, valores: {}, terceros: [] };
      n2.cuentas.push(n3);
    }
    for (const [cc, v] of Object.entries(vals)) n3.valores[cc] = (n3.valores[cc] ?? 0) + v;
    n3.terceros.push({ tercero: terc?.replace(/\d+$/, "").trim() || "Sin identificar", nit, valores: vals });
  }
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
              terceros: n3.terceros.sort((a, b) => sumAll(b.valores) - sumAll(a.valores)),
            })),
        })),
    }));
}

function TabPorCC({ plan, filtros }: TabProps) {
  const [mesLocal, setMesLocal] = useState<number | "Todos">("Todos");
  const gastos = useGastosPorCC({ año: filtros.año, mes: mesLocal, compania: filtros.compania });
  const eriCC = useEriAllCC({ año: filtros.año, compania: filtros.compania, mes: mesLocal });
  const tree = useMemo(() => buildTree(gastos.data ?? []), [gastos.data]);

  const eriMap = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const r of eriCC.data ?? []) {
      if (!m.has(r.orden)) m.set(r.orden, new Map());
      const inner = m.get(r.orden)!;
      inner.set(r.cc_key, (inner.get(r.cc_key) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return m;
  }, [eriCC.data]);

  const getVals = (orden: number): VCC => {
    const inner = eriMap.get(orden);
    if (!inner) return {};
    const r: VCC = {};
    for (const [cc, v] of inner.entries()) r[cc] = v;
    return r;
  };

  const [openN1, setOpenN1] = useState<Set<string>>(new Set());
  const [openN2, setOpenN2] = useState<Set<string>>(new Set());
  const [openN3, setOpenN3] = useState<Set<string>>(new Set());
  const [openSec, setOpenSec] = useState<Set<string>>(new Set(["ing", "cost", "gop", "oi", "og"]));

  const togSec = (k: string) =>
    setOpenSec((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });

  const togN1 = (k: string) =>
    setOpenN1((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });
  const togN2 = (k: string) =>
    setOpenN2((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });
  const togN3 = (k: string) =>
    setOpenN3((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });

  const planRows: PlanPygRow[] = plan.data ?? [];
  const ingCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "41",
  );
  const costCuentas = planRows.filter((r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "6");
  const oiCuentas = planRows.filter(
    (r) => r.nivel === "Cuenta" && String((r as any).clase_cod) === "4" && String((r as any).grupo_cod) === "42",
  );

  const vIng: VCC = {};
  for (const row of ingCuentas) {
    const v = getVals(row.orden);
    for (const [cc, val] of Object.entries(v)) vIng[cc] = (vIng[cc] ?? 0) + val;
  }
  const vCost: VCC = {};
  for (const row of costCuentas) {
    const v = getVals(row.orden);
    for (const [cc, val] of Object.entries(v)) vCost[cc] = (vCost[cc] ?? 0) + val;
  }
  const vUB: VCC = {};
  for (const cc of CC_KEYS) vUB[cc.key] = (vIng[cc.key] ?? 0) + (vCost[cc.key] ?? 0);

  const gopVals = tree.find((n) => n.tipo_gasto === "01.GASTOS OPERACIONALES")?.valores ?? {};
  const vUO: VCC = {};
  for (const cc of CC_KEYS) vUO[cc.key] = (vUB[cc.key] ?? 0) - (gopVals[cc.key] ?? 0);

  const vOI: VCC = {};
  for (const row of oiCuentas) {
    const v = getVals(row.orden);
    for (const [cc, val] of Object.entries(v)) vOI[cc] = (vOI[cc] ?? 0) + val;
  }

  const gnopVals = tree.find((n) => n.tipo_gasto === "02.GASTO NO OPERACIONAL")?.valores ?? {};
  const vUAI: VCC = {};
  const allCCKeys = new Set([...CC_KEYS.map((c) => c.key), ...Object.keys(vOI), ...Object.keys(gnopVals)]);
  for (const cc of allCCKeys) {
    vUAI[cc] = (vUO[cc] ?? 0) + (vOI[cc] ?? 0) - (gnopVals[cc] ?? 0);
  }

  const año = filtros.año === "Todas" ? 2026 : Number(filtros.año);
  const meses = [
    { value: "Todos" as const, label: "Acumulado" },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
      value: año * 100 + m,
      label: mesLabel(año * 100 + m),
    })),
  ];

  const col = "px-2 py-1.5 text-right text-[11px] tabular-nums whitespace-nowrap min-w-[110px]";
  const ingTotal = sumAll(vIng) || 1;

  const CV = (vals: VCC, cc: { key: string }, bold = false) => {
    const f = fmtCell(vals[cc.key] ?? 0);
    return (
      <td
        key={cc.key}
        className={`${col} ${bold ? "font-bold" : ""} ${
          f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"
        }`}
      >
        {f.text}
      </td>
    );
  };

  const CC_ = (vals: VCC, bold = false) => {
    const v = sumAll(vals);
    const f = fmtCell(v);
    return (
      <td
        className={`${col} ${bold ? "font-bold" : ""} ${
          f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-primary"
        }`}
      >
        {f.text}
      </td>
    );
  };

  const PCT = (vals: VCC, cc: { key: string }, bold = false) => {
    const ci = vIng[cc.key] ?? 0;
    const v = vals[cc.key] ?? 0;
    if (!v || !ci)
      return (
        <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground/20 whitespace-nowrap min-w-[55px]">
          -
        </td>
      );
    return (
      <td
        className={`px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[55px] ${
          bold ? "font-bold" : ""
        } text-muted-foreground/70`}
      >
        {((v / ci) * 100).toFixed(2)}%
      </td>
    );
  };

  const PCTC = (vals: VCC, bold = false) => {
    const v = sumAll(vals);
    if (!v)
      return (
        <td className="px-2 py-1.5 text-right text-[10px] whitespace-nowrap min-w-[60px] text-muted-foreground/20">
          -
        </td>
      );
    return (
      <td
        className={`px-2 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap min-w-[60px] ${
          bold ? "font-bold" : ""
        } text-muted-foreground/70`}
      >
        {((v / ingTotal) * 100).toFixed(2)}%
      </td>
    );
  };

  const SH = ({ label, k }: { label: string; k: string }) => (
    <tr style={{ background: "#1e2d42" }} className="cursor-pointer hover:opacity-90" onClick={() => togSec(k)}>
      <td
        colSpan={CC_KEYS.length * 2 + 3}
        className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground"
      >
        <span className="mr-2 text-[10px] text-muted-foreground">{openSec.has(k) ? "▼" : "▶"}</span>
        {label}
      </td>
    </tr>
  );

  const TR = ({ label, vals }: { label: string; vals: VCC }) => (
    <tr className="border-b border-border" style={{ background: sumAll(vals) >= 0 ? "#1a2d1a" : "#2d1a1a" }}>
      <td className="px-3 py-1.5 text-[11px] font-bold text-foreground">{label}</td>
      {CC_KEYS.map((cc) => (
        <Fragment key={cc.key}>
          {CV(vals, cc, true)}
          {PCT(vals, cc, true)}
        </Fragment>
      ))}
      {CC_(vals, true)}
      {PCTC(vals, true)}
    </tr>
  );

  const SR = ({ label, vals }: { label: string; vals: VCC }) => (
    <tr className="border-b border-border border-l-2 border-l-primary" style={{ background: "#0d2040" }}>
      <td className="px-3 py-2 text-[12px] font-bold text-foreground">{label}</td>
      {CC_KEYS.map((cc) => (
        <Fragment key={cc.key}>
          {CV(vals, cc, true)}
          {PCT(vals, cc, true)}
        </Fragment>
      ))}
      {CC_(vals, true)}
      {PCTC(vals, true)}
    </tr>
  );

  const CR = ({ row, idx }: { row: PlanPygRow; idx: number }) => {
    const vals = getVals(row.orden);
    const cons = sumAll(vals);
    if (CC_KEYS.every((cc) => (vals[cc.key] ?? 0) === 0) && cons === 0) return null;
    return (
      <tr className={`border-b border-border/20 ${idx % 2 === 0 ? "bg-background/10" : ""}`}>
        <td className="px-3 py-1 pl-8 text-[11px] text-muted-foreground">{row.etiqueta_fila || row.concepto}</td>
        {CC_KEYS.map((cc) => (
          <Fragment key={cc.key}>
            {CV(vals, cc)}
            {PCT(vals, cc)}
          </Fragment>
        ))}
        {CC_(vals)}
        {PCTC(vals)}
      </tr>
    );
  };

  const GasTree = ({ n1 }: { n1: N1 }) => {
    const k1 = n1.tipo_gasto;
    const o1 = openN1.has(k1);
    return (
      <Fragment key={k1}>
        <tr
          className="cursor-pointer border-b border-border/40 hover:opacity-90"
          style={{ background: "#151f33" }}
          onClick={() => togN1(k1)}
        >
          <td className="px-3 py-1.5 pl-5 text-[11px] font-semibold text-foreground">
            <span className="mr-2 text-[10px] text-muted-foreground">{o1 ? "▼" : "▶"}</span>
            {n1.tipo_gasto}
          </td>
          {CC_KEYS.map((cc) => (
            <Fragment key={cc.key}>
              {CV(n1.valores, cc, true)}
              {PCT(n1.valores, cc, true)}
            </Fragment>
          ))}
          {CC_(n1.valores, true)}
          {PCTC(n1.valores, true)}
        </tr>
        {o1 &&
          n1.detalles.map((n2) => {
            const k2 = `${k1}||${n2.detalle_gasto}`;
            const o2 = openN2.has(k2);
            if (sumAll(n2.valores) === 0) return null;
            return (
              <Fragment key={k2}>
                <tr
                  className="cursor-pointer border-b border-border/30 hover:opacity-90"
                  style={{ background: "#0d1525" }}
                  onClick={() => togN2(k2)}
                >
                  <td className="px-3 py-1.5 pl-10 text-[11px] text-muted-foreground">
                    <span className="mr-2 text-[10px] text-muted-foreground/60">{o2 ? "▾" : "▸"}</span>
                    {n2.detalle_gasto}
                  </td>
                  {CC_KEYS.map((cc) => (
                    <Fragment key={cc.key}>
                      {CV(n2.valores, cc)}
                      {PCT(n2.valores, cc)}
                    </Fragment>
                  ))}
                  {CC_(n2.valores)}
                  {PCTC(n2.valores)}
                </tr>
                {o2 &&
                  n2.cuentas.map((n3) => {
                    const k3 = `${k2}||${n3.nombre_cuenta}`;
                    const o3 = openN3.has(k3);
                    if (sumAll(n3.valores) === 0) return null;
                    return (
                      <Fragment key={k3}>
                        <tr
                          className="cursor-pointer border-b border-border/10 hover:opacity-80"
                          onClick={() => togN3(k3)}
                        >
                          <td className="px-3 py-1 pl-16 text-[11px] text-muted-foreground/80">
                            <span className="mr-2 text-[10px] text-muted-foreground/40">{o3 ? "▾" : "▸"}</span>
                            {n3.nombre_cuenta}
                          </td>
                          {CC_KEYS.map((cc) => (
                            <Fragment key={cc.key}>
                              {CV(n3.valores, cc)}
                              {PCT(n3.valores, cc)}
                            </Fragment>
                          ))}
                          {CC_(n3.valores)}
                          {PCTC(n3.valores)}
                        </tr>
                        {o3 &&
                          n3.terceros.map((t, ti) => {
                            const ct = sumAll(t.valores);
                            const ft = fmtCell(ct);
                            return (
                              <tr
                                key={`${k3}||${ti}`}
                                className="border-b border-border/10"
                                style={{ background: "#080c18" }}
                              >
                                <td className="px-3 py-0.5 pl-20">
                                  <div className="flex items-center gap-2">
                                    {t.nit && t.nit !== "SIN TERCERO" && (
                                      <span className="flex-shrink-0 rounded bg-muted/40 px-1 font-mono text-[9px] text-muted-foreground">
                                        {t.nit}
                                      </span>
                                    )}
                                    {CC_KEYS.filter((cc) => (t.valores[cc.key] ?? 0) !== 0).length === 1 && (
                                      <span className="flex-shrink-0 rounded bg-primary/20 px-1 font-mono text-[9px] text-primary/70">
                                        {CC_KEYS.find((cc) => (t.valores[cc.key] ?? 0) !== 0)?.label}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground/60">{t.tercero}</span>
                                  </div>
                                </td>
                                {CC_KEYS.map((cc) => {
                                  const f = fmtCell(t.valores[cc.key] ?? 0);
                                  return (
                                    <Fragment key={cc.key}>
                                      <td
                                        className={`${col} text-[10px] ${
                                          f.neg
                                            ? "text-destructive"
                                            : f.zero
                                              ? "text-muted-foreground/20"
                                              : "text-muted-foreground/50"
                                        }`}
                                      >
                                        {f.text}
                                      </td>
                                      <td className="px-2 py-0.5 min-w-[55px]" />
                                    </Fragment>
                                  );
                                })}
                                <td
                                  className={`${col} text-[10px] ${
                                    ft.neg ? "text-destructive" : "text-muted-foreground/50"
                                  }`}
                                >
                                  {ft.text}
                                </td>
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

  const gopTree = tree.find((n) => n.tipo_gasto === "01.GASTOS OPERACIONALES");
  const gnopTree = tree.find((n) => n.tipo_gasto === "02.GASTO NO OPERACIONAL");
  const isLoading = plan.isLoading || gastos.isLoading || eriCC.isLoading;

  // Funciones nombradas para expandir/contraer (evita problemas de parsing JSX con llaves anidadas)
  const handleExpandAll = () => {
    setOpenN1(new Set(tree.map((n) => n.tipo_gasto)));
    setOpenN2(new Set(tree.flatMap((n) => n.detalles.map((d) => `${n.tipo_gasto}||${d.detalle_gasto}`))));
    setOpenN3(
      new Set(
        tree.flatMap((n) =>
          n.detalles.flatMap((d) => d.cuentas.map((c) => `${n.tipo_gasto}||${d.detalle_gasto}||${c.nombre_cuenta}`)),
        ),
      ),
    );
  };

  const handleCollapseAll = () => {
    setOpenN1(new Set());
    setOpenN2(new Set());
    setOpenN3(new Set());
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Mes:</span>
          {meses.map((m) => (
            <button
              key={String(m.value)}
              onClick={() => setMesLocal(m.value as number | "Todos")}
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
          <button
            onClick={handleExpandAll}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Expandir todo
          </button>
          <button
            onClick={handleCollapseAll}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Contraer todo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[240px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                {CC_KEYS.map((cc) => (
                  <Fragment key={cc.key}>
                    <th className="min-w-[110px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cc.label}
                    </th>
                    <th className="min-w-[55px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      %
                    </th>
                  </Fragment>
                ))}
                <th className="min-w-[120px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Consolidado
                </th>
                <th className="min-w-[60px] whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              <SH label="INGRESOS OPERACIONALES" k="ing" />
              {openSec.has("ing") && ingCuentas.map((r, i) => <CR key={r.orden} row={r} idx={i} />)}
              {openSec.has("ing") && <TR label="TOTAL INGRESOS OPERACIONALES" vals={vIng} />}

              <SH label="COSTOS DE VENTAS" k="cost" />
              {openSec.has("cost") && costCuentas.map((r, i) => <CR key={r.orden} row={r} idx={i} />)}
              {openSec.has("cost") && <TR label="TOTAL COSTOS" vals={vCost} />}

              <SR label="UTILIDAD BRUTA" vals={vUB} />

              <SH label="GASTOS OPERACIONALES" k="gop" />
              {openSec.has("gop") && gopTree && <GasTree n1={gopTree} />}
              <SR label="UTILIDAD OPERACIONAL" vals={vUO} />

              <SH label="OTROS INGRESOS" k="oi" />
              {openSec.has("oi") && oiCuentas.map((r, i) => <CR key={r.orden} row={r} idx={i} />)}
              {openSec.has("oi") && <TR label="TOTAL OTROS INGRESOS" vals={vOI} />}

              <SH label="OTROS GASTOS" k="og" />
              {openSec.has("og") && gnopTree && <GasTree n1={gnopTree} />}

              <SR label="UTILIDAD ANTES DE IMPUESTOS" vals={vUAI} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
