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

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))"];

export default function Dashboard() {
  const filtros = useFiltros();
  const { data: kpis, isLoading: kpisLoading } = useKpis(filtros);
  const { data: tendencia, isLoading: tendLoading } = useTendencia(filtros);

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
    ingresosRaw: t.ingresos,
  }));

  const totalPasivoPatrimonio = (kpis?.pasivos_totales ?? 0) + (kpis?.patrimonio_total ?? 0);
  const capitalData = totalPasivoPatrimonio > 0
    ? [
        { name: "Patrimonio", value: kpis?.patrimonio_total ?? 0 },
        { name: "Pasivos", value: kpis?.pasivos_totales ?? 0 },
      ]
    : [];

  const balance = [
    { label: "Activos Totales", value: formatCOP(kpis?.activos_totales), delta: formatPct(kpis?.autonomia_pct) },
    { label: "Pasivos Totales", value: formatCOP(kpis?.pasivos_totales), delta: formatPct(kpis?.endeudamiento_pct) },
    { label: "Patrimonio", value: formatCOP(kpis?.patrimonio_total), delta: formatPct(kpis?.autonomia_pct) },
  ];

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
              <div className="h-full w-full animate-pulse rounded bg-background/40" />
            ) : trendData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v: number) => `${v.toFixed(0)}M`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "Ingresos") return [formatCOP((value as number) * 1_000_000), name];
                      return [`${(value as number).toFixed(2)}%`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margen"
                    name="Margen Operacional %"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Balance General">
          <div className="space-y-2">
            {balance.map((b) => (
              <div key={b.label} className="rounded-md border border-border bg-background/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{b.label}</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-lg font-bold text-foreground">{b.value}</div>
                  <div className="text-[11px] font-semibold text-success">{b.delta}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Estructura de Capital">
          <div className="h-72">
            {capitalData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={capitalData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {capitalData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatCOP(v as number)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
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

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Sin datos para los filtros seleccionados
    </div>
  );
}
