import { useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useFiltros } from "@/context/FiltrosContext";
import { useEri, usePlanPyg, type PlanPygRow } from "@/hooks/useEri";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/dashboard/StateMessages";

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

export default function Eri() {
  const filtros = useFiltros();
  const plan = usePlanPyg();
  const eri = useEri(filtros);

  const { rows, months } = useMemo(() => {
    const planRows: PlanPygRow[] = plan.data ?? [];
    const dataRows = eri.data ?? [];

    // Aggregate values: orden -> mes -> sum
    const valueMap = new Map<number, Map<number, number>>();
    const monthSet = new Set<number>();
    for (const r of dataRows) {
      monthSet.add(r.año_mes_num);
      let inner = valueMap.get(r.orden);
      if (!inner) {
        inner = new Map();
        valueMap.set(r.orden, inner);
      }
      inner.set(r.año_mes_num, (inner.get(r.año_mes_num) ?? 0) + (Number(r.valor_pyg) || 0));
    }

    const months = Array.from(monthSet).sort((a, b) => a - b);
    return { rows: planRows, months };
  }, [plan.data, eri.data]);

  // Map orden -> mes -> value (computed once for rendering)
  const valueMap = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    for (const r of eri.data ?? []) {
      let inner = map.get(r.orden);
      if (!inner) {
        inner = new Map();
        map.set(r.orden, inner);
      }
      inner.set(r.año_mes_num, (inner.get(r.año_mes_num) ?? 0) + (Number(r.valor_pyg) || 0));
    }
    return map;
  }, [eri.data]);

  const isLoading = plan.isLoading || eri.isLoading;
  const isError = plan.isError || eri.isError;

  return (
    <AppLayout title="Estado de Resultados">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Estado de Resultados Integral (ERI)
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState />
        ) : rows.length === 0 || months.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                    Grupo
                  </th>
                  <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                    Concepto
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="whitespace-nowrap px-2 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {mesLabel(m)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-2 py-2 text-right font-semibold uppercase tracking-wider text-primary">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const inner = valueMap.get(row.orden);
                  const monthValues = months.map((m) => inner?.get(m) ?? 0);
                  const total = monthValues.reduce((s, v) => s + v, 0);
                  const isTitulo = row.nivel === "Titulo";
                  const isTotal = row.nivel === "Total";
                  const isSubtotal = row.nivel === "Subtotal";

                  let rowStyle: React.CSSProperties = {};
                  let rowClass = "border-b border-border/40";
                  if (isTitulo) {
                    rowStyle.background = "#1e2d42";
                    rowClass += " font-bold text-foreground";
                  } else if (isTotal) {
                    rowStyle.background = total >= 0 ? "#1a2d1a" : "#2d1a1a";
                    rowClass += " font-bold";
                  } else if (isSubtotal) {
                    rowClass += " font-bold text-[12px] border-l-2 border-l-primary bg-background/40";
                  } else {
                    rowClass += idx % 2 === 0 ? " bg-background/20" : "";
                  }

                  return (
                    <tr key={`${row.orden}-${idx}`} className={rowClass} style={rowStyle}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                        {row.grupo_titulo}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">{row.etiqueta_fila || row.concepto}</td>
                      {isTitulo
                        ? months.map((m) => <td key={m} className="px-2 py-1.5"></td>)
                        : monthValues.map((v, i) => {
                            const f = formatCell(v);
                            return (
                              <td
                                key={i}
                                className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${
                                  f.negative ? "text-destructive" : f.zero ? "text-muted-foreground" : "text-foreground"
                                }`}
                              >
                                {f.text}
                              </td>
                            );
                          })}
                      {isTitulo ? (
                        <td className="px-2 py-1.5"></td>
                      ) : (
                        (() => {
                          const f = formatCell(total);
                          return (
                            <td
                              className={`whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums ${
                                f.negative ? "text-destructive" : f.zero ? "text-muted-foreground" : "text-foreground"
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
    </AppLayout>
  );
}
