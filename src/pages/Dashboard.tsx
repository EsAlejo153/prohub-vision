import AppLayout from "@/components/layout/AppLayout";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useFiltros } from "@/context/FiltrosContext";
import { useKpis } from "@/hooks/useKpis";
import { useTendencia } from "@/hooks/useTendencia";
import { formatCOP, formatPct, toMillones } from "@/lib/format";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/dashboard/StateMessages";

export default function Dashboard() {
  const filtros = useFiltros();
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useKpis(filtros);
  const { data: tendencia, isLoading: tendLoading, isError: tendError } = useTendencia(filtros);

  const kpiCards = [
    { label: "Ingresos Operativos", value: formatCOP(kpis?.ingresos), subtitle: "Periodo seleccionado", positive: true },
    { label: "Utilidad Operacional", value: formatCOP(kpis?.utilidad_operacional), subtitle: "Periodo seleccionado", positive: (kpis?.utilidad_operacional ?? 0) >= 0 },
    { label: "Utilidad Neta", value: formatCOP(kpis?.utilidad_neta), subtitle: "Periodo seleccionado", positive: (kpis?.utilidad_neta ?? 0) >= 0 },
    { label: "Margen Neto %", value: formatPct(kpis?.margen_neto_pct), subtitle: "Promedio del periodo", positive: (kpis?.margen_neto_pct ?? 0) >= 0 },
    { label: "ROA", value: formatPct(kpis?.roa_pct), subtitle: "Retorno sobre activos", positive: (kpis?.roa_pct ?? 0) >= 0 },
    { label: "ROE", value: formatPct(kpis?.roe_pct), subtitle: "Retorno sobre patrimonio", positive: (kpis?.roe_pct ?? 0) >= 0 },
    { label: "Margen Bruto %", value: formatPct(kpis?.margen_bruto_pct), subtitle: "Promedio del periodo", positive: (kpis?.margen_bruto_pct ?? 0) >= 0 },
    { label: "Costo / Ingreso", value: formatPct(kpis?.costo_ingreso_pct), subtitle: "Promedio del periodo", positive: false },
  ];

  const trendData = (tendencia ?? []).map((t) => ({
    mes: t.mes_label,
    ingresos: toMillones(t.ingresos),
    margen: Number(t.margen_operacional_pct) || 0,
  }));

  // Capital structure
  const pasivos = kpis?.pasivos_totales ?? 0;
  const patrimonio = kpis?.patrimonio_total ?? 0;
  const totalCap = Math.abs(pasivos) + Math.abs(patrimonio);
  const pasivosPct = totalCap > 0 ? (Math.abs(pasivos) / totalCap) * 100 : 0;
  const patrimonioPct = totalCap > 0 ? (Math.abs(patrimonio) / totalCap) * 100 : 0;
  const PASIVOS_COLOR = "#ef4444";
  const PATRIMONIO_COLOR = patrimonio < 0 ? "#ef4444" : "#10b981";
  const capitalData = totalCap > 0
    ? [
        { name: "Pasivos", value: Math.abs(pasivos), color: PASIVOS_COLOR },
        { name: "Patrimonio", value: Math.abs(patrimonio), color: PATRIMONIO_COLOR },
      ]
    : [];

  // Balance ratios with thresholds
  const activos = kpis?.activos_totales ?? 0;
  const cobertura = pasivos > 0 ? activos / pasivos : null; // proxy razón corriente
  const endeudamiento = kpis?.endeudamiento_pct ?? 0;
  const autonomia = kpis?.autonomia_pct ?? 0;

  const coberturaTone = cobertura == null ? "neutral" : cobertura > 1 ? "good" : "bad";
  const endeudamientoTone = endeudamiento > 100 ? "bad" : endeudamiento >= 50 ? "warn" : "good";
  const autonomiaTone = autonomia > 30 ? "good" : autonomia < 0 ? "bad" : "warn";

  return (
    <AppLayout title="Dashboard Financiero">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpisLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
            ))
          : kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:[grid-template-columns:45fr_30fr_25fr]">
        <Panel title="Tendencia: Ingresos · Margen Operacional">
          <div className="h-72">
            {tendLoading ? (
              <LoadingSkeleton />
            ) : tendError ? (
              <ErrorState />
            ) : trendData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v: number) => `${v.toFixed(0)}M`} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === "Ingresos") return [formatCOP((value as number) * 1_000_000), name];
                      return [`${(value as number).toFixed(2)}%`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="ingresos" name="Ingresos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="margen" name="Margen Operacional %" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Balance General">
          {kpisLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <LoadingSkeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : kpisError ? (
            <ErrorState />
          ) : !kpis ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              <BalanceCard
                label="Activos Totales"
                value={formatCOP(activos)}
                badge={cobertura != null ? `Cobertura A/P ${cobertura.toFixed(2)}x` : "Sin pasivos"}
                tone={coberturaTone}
              />
              <BalanceCard
                label="Pasivos Totales"
                value={formatCOP(pasivos)}
                badge={`Endeudamiento ${formatPct(endeudamiento)}`}
                tone={endeudamientoTone}
              />
              <BalanceCard
                label="Patrimonio"
                value={formatCOP(patrimonio)}
                badge={`Autonomía ${formatPct(autonomia)}`}
                tone={autonomiaTone}
              />
            </div>
          )}
        </Panel>

        <Panel title="Estructura de Capital">
          <div className="h-72">
            {kpisLoading ? (
              <LoadingSkeleton />
            ) : kpisError ? (
              <ErrorState />
            ) : capitalData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="relative h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capitalData} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {capitalData.map((d, i) => (
                        <Cell key={i} fill={d.color} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => formatCOP(v as number)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PASIVOS_COLOR }}>
                    Pasivos {pasivosPct.toFixed(0)}%
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PATRIMONIO_COLOR }}>
                    Patrimonio {patrimonioPct.toFixed(0)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </AppLayout>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function BalanceCard({
  label,
  value,
  badge,
  tone,
}: {
  label: string;
  value: string;
  badge: string;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "bg-success/15 text-success border-success/30"
      : tone === "bad"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
      <div className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
        {badge}
      </div>
    </div>
  );
}
