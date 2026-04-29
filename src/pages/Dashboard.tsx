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

const kpis = [
  { label: "Ingresos Operativos", value: "$2,847M", subtitle: "+12.4% vs mes anterior", positive: true },
  { label: "EBITDA (Mes)", value: "$684M", subtitle: "+8.1% vs mes anterior", positive: true },
  { label: "Utilidad Neta", value: "$412M", subtitle: "+15.2% vs mes anterior", positive: true },
  { label: "Margen Neto %", value: "14.5%", subtitle: "+1.2pp vs mes anterior", positive: true },
  { label: "ROA", value: "8.7%", subtitle: "Retorno sobre activos", positive: true },
  { label: "ROE", value: "18.3%", subtitle: "Retorno sobre patrimonio", positive: true },
  { label: "Margen Bruto %", value: "42.8%", subtitle: "-0.4pp vs mes anterior", positive: false },
  { label: "Costo / Ingreso", value: "57.2%", subtitle: "+0.4pp vs mes anterior", positive: false },
];

const trendData = [
  { mes: "Ene", ingresos: 2100, margen: 22 },
  { mes: "Feb", ingresos: 2280, margen: 24 },
  { mes: "Mar", ingresos: 2150, margen: 21 },
  { mes: "Abr", ingresos: 2480, margen: 25 },
  { mes: "May", ingresos: 2630, margen: 26 },
  { mes: "Jun", ingresos: 2540, margen: 24 },
  { mes: "Jul", ingresos: 2710, margen: 27 },
  { mes: "Ago", ingresos: 2847, margen: 28 },
];

const capitalData = [
  { name: "Patrimonio", value: 62 },
  { name: "Pasivo Largo Plazo", value: 23 },
  { name: "Pasivo Corto Plazo", value: 15 },
];
const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))"];

const balance = [
  { label: "Activos Totales", value: "$4,732M", delta: "+5.2%" },
  { label: "Pasivos Totales", value: "$1,798M", delta: "+2.1%" },
  { label: "Patrimonio", value: "$2,934M", delta: "+7.8%" },
];

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard Financiero">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:[grid-template-columns:45fr_30fr_25fr]">
        <Panel title="Tendencia: Ingresos · Margen Operacional">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="margen" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={capitalData}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
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
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
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
