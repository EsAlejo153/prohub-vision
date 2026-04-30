import AppLayout from "@/components/layout/AppLayout";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Cell,
} from "recharts";
import { useFiltros } from "@/context/FiltrosContext";
import {
  useKpisMesAMes,
  useDistribucionGastos,
  useTopCuentas,
  type KpiMesRow,
} from "@/hooks/useDashboardPremium";
import { useMemo } from "react";
import { TrendingUp, AlertCircle } from "lucide-react";

// ===== Color tokens =====
const C = {
  pageBg: "#080c18",
  cardBg: "#0f1929",
  cardBorder: "#1a2332",
  card2Bg: "#0a1020",
  card2Border: "#151f33",
  textPrimary: "#f0f4ff",
  textMuted: "#a0aabf",
  textDim: "#6b7a99",
  positive: "#10b981",
  negative: "#ef4444",
  warning: "#f59e0b",
  blue: "#3b82f6",
  blueDark: "#1d4ed8",
  indigo: "#6366f1",
};

// ===== Formatters =====
const formatM = (val: number) => {
  if (!Number.isFinite(val)) return "$0";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}MM`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatPctV = (val: number | null | undefined) => {
  if (val == null || !Number.isFinite(val)) return "--";
  return `${val.toFixed(1)}%`;
};

const deltaArrow = (v: number | null | undefined) => (v == null ? "=" : v >= 0 ? "↑" : "↓");
const deltaColor = (v: number | null | undefined) =>
  v == null ? C.textDim : v >= 0 ? C.positive : C.negative;

// ===== Sparkline =====
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 70;
  const h = 32;
  const max = Math.max(...values.map((v) => Math.abs(v))) || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v / max) * h * 0.4 + h * 0.5);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      style={{ position: "absolute", right: 10, bottom: 10, opacity: 0.5 }}
      aria-hidden
    >
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
    </svg>
  );
}

// ===== Hero KPI Card =====
function HeroCard({
  label,
  value,
  delta,
  prevLabel,
  sub,
  sparkValues,
  highlight,
  valueColor,
}: {
  label: string;
  value: string;
  delta: number | null;
  prevLabel: string | null;
  sub: string;
  sparkValues: number[];
  highlight?: boolean;
  valueColor?: string;
}) {
  const sparkColor = delta == null ? C.blue : delta >= 0 ? C.positive : C.negative;
  return (
    <div
      style={{
        position: "relative",
        background: C.cardBg,
        border: `0.5px solid ${highlight ? C.blueDark : C.cardBorder}`,
        borderRadius: 8,
        padding: 12,
        minHeight: 110,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: C.textDim,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: valueColor ?? C.textPrimary,
          fontVariantNumeric: "tabular-nums",
          marginTop: 6,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: deltaColor(delta), fontVariantNumeric: "tabular-nums" }}>
        {deltaArrow(delta)} {delta == null ? "—" : `${Math.abs(delta).toFixed(1)}%`}
        {prevLabel && <span style={{ color: C.textDim }}> vs {prevLabel}</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 9, color: "#4a5568" }}>{sub}</div>
      <Sparkline values={sparkValues} color={sparkColor} />
    </div>
  );
}

// ===== Ratio Card =====
function RatioCard({
  label,
  value,
  delta,
  valueColor,
  prevLabel,
}: {
  label: string;
  value: string;
  delta: number | null;
  valueColor?: string;
  prevLabel: string | null;
}) {
  return (
    <div
      style={{
        background: C.card2Bg,
        border: `0.5px solid ${C.card2Border}`,
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: valueColor ?? C.textPrimary,
          fontVariantNumeric: "tabular-nums",
          marginTop: 2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 9, color: deltaColor(delta), marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {deltaArrow(delta)} {delta == null ? "—" : `${Math.abs(delta).toFixed(1)}%`}
        {prevLabel && <span style={{ color: C.textDim }}> vs {prevLabel}</span>}
      </div>
    </div>
  );
}

function Skel({ h = 110 }: { h?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ background: C.cardBg, border: `0.5px solid ${C.cardBorder}`, borderRadius: 8, height: h }}
    />
  );
}

function EmptyMsg() {
  return (
    <div className="flex flex-col items-center justify-center py-10" style={{ color: C.textMuted }}>
      <AlertCircle className="h-6 w-6 mb-2" style={{ color: C.blue }} />
      <div style={{ fontSize: 12 }}>Sin datos para el período seleccionado</div>
    </div>
  );
}

// ===== Custom Tooltip =====
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#111827",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        color: C.textPrimary,
      }}
    >
      <div style={{ color: C.textMuted, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontVariantNumeric: "tabular-nums" }}>
          {p.name}: {p.dataKey === "margen" ? `${Number(p.value).toFixed(1)}%` : formatM(Number(p.value) * 1_000_000)}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const filtros = useFiltros();
  const { data: rows = [], isLoading } = useKpisMesAMes(filtros);
  const { data: distRows = [] } = useDistribucionGastos(filtros);
  const { data: topRows = [] } = useTopCuentas(filtros);

  const last = rows.length ? rows[rows.length - 1] : null;
  const prevLabel = rows.length >= 2 ? rows[rows.length - 2].mes_label : null;

  // Aggregates
  const totals = useMemo(() => {
    const sum = (k: keyof KpiMesRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return {
      ingresos: sum("ingresos"),
      utilOper: sum("utilidad_operacional"),
      utilNeta: sum("utilidad_neta"),
      activos: sum("activos_totales"),
      pasivos: sum("pasivos_totales"),
      patrimonio: sum("patrimonio_total"),
    };
  }, [rows]);

  const sparks = useMemo(
    () => ({
      ingresos: rows.map((r) => Number(r.ingresos) || 0),
      utilOper: rows.map((r) => Number(r.utilidad_operacional) || 0),
      utilNeta: rows.map((r) => Number(r.utilidad_neta) || 0),
    }),
    [rows]
  );

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        mes: r.mes_label,
        ingresos: (Number(r.ingresos) || 0) / 1_000_000,
        margen: Number(r.margen_operacional_pct) || 0,
      })),
    [rows]
  );

  // Distribución gastos (averaged across months)
  const dist = useMemo(() => {
    if (!distRows.length) return { adm: 0, oper: 0, fin: 0, costos: 0 };
    const avg = (k: keyof typeof distRows[number]) =>
      distRows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / distRows.length;
    return {
      adm: avg("pct_adm"),
      oper: avg("pct_oper"),
      fin: avg("pct_fin"),
      costos: avg("pct_costos"),
    };
  }, [distRows]);

  // Top cuentas (aggregate across months by cuenta_codigo)
  const topAgg = useMemo(() => {
    const map = new Map<string, { nombre: string; valor: number; part: number; n: number }>();
    for (const r of topRows) {
      const key = r.cuenta_codigo;
      const ex = map.get(key);
      if (ex) {
        ex.valor += Number(r.valor) || 0;
        ex.part += Number(r.participacion_pct) || 0;
        ex.n += 1;
      } else {
        map.set(key, {
          nombre: r.cuenta_nombre,
          valor: Number(r.valor) || 0,
          part: Number(r.participacion_pct) || 0,
          n: 1,
        });
      }
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, part: r.part / r.n }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [topRows]);

  const valColor = (v: number) => (v < 0 ? C.negative : C.positive);

  // Ratios from last month
  const margenBruto = last?.margen_bruto_pct ?? 0;
  const margenNeto = last?.margen_neto_pct ?? 0;
  const costoIngreso = last?.costo_ingreso_pct ?? 0;
  const roe = last?.roe_pct ?? 0;
  const endeudamiento = last?.endeudamiento_pct ?? 0;
  const autonomia = last?.autonomia_pct ?? 0;

  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const dPct = (curr: number, prv: number | undefined) =>
    prv == null || prv === 0 ? null : ((curr - prv) / Math.abs(prv)) * 100;

  return (
    <AppLayout title="Dashboard Financiero">
      <div style={{ background: C.pageBg, margin: -24, padding: 16, minHeight: "calc(100vh - 56px)" }}>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            <Skel /><Skel /><Skel />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background: C.cardBg, border: `0.5px solid ${C.cardBorder}`, borderRadius: 8 }}>
            <EmptyMsg />
          </div>
        ) : (
          <>
            {/* ROW 1 — Hero KPIs */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <HeroCard
                label="Ingresos operativos"
                value={formatM(totals.ingresos)}
                delta={last?.delta_ingresos_pct ?? null}
                prevLabel={prevLabel}
                sub={`Acumulado ${rows[0]?.mes_label}–${last?.mes_label} ${filtros.año === "Todas" ? "" : filtros.año}`}
                sparkValues={sparks.ingresos}
                highlight
              />
              <HeroCard
                label="Utilidad operacional"
                value={formatM(totals.utilOper)}
                valueColor={valColor(totals.utilOper)}
                delta={last?.delta_util_oper_pct ?? null}
                prevLabel={prevLabel}
                sub="Resultado operativo neto"
                sparkValues={sparks.utilOper}
              />
              <HeroCard
                label="Utilidad neta"
                value={formatM(totals.utilNeta)}
                valueColor={valColor(totals.utilNeta)}
                delta={last?.delta_util_neta_pct ?? null}
                prevLabel={prevLabel}
                sub="Después de gastos financieros"
                sparkValues={sparks.utilNeta}
              />
            </div>

            {/* ROW 2 — Ratios */}
            <div
              className="grid gap-2 mt-3"
              style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
            >
              <RatioCard
                label="Margen bruto %"
                value={formatPctV(margenBruto)}
                delta={dPct(margenBruto, prev?.margen_bruto_pct)}
                prevLabel={prevLabel}
              />
              <RatioCard
                label="Margen neto %"
                value={formatPctV(margenNeto)}
                valueColor={margenNeto < 0 ? C.negative : C.textPrimary}
                delta={dPct(margenNeto, prev?.margen_neto_pct)}
                prevLabel={prevLabel}
              />
              <RatioCard
                label="Costo / Ingreso"
                value={formatPctV(costoIngreso)}
                valueColor={costoIngreso > 80 ? C.warning : C.textPrimary}
                delta={dPct(costoIngreso, prev?.costo_ingreso_pct)}
                prevLabel={prevLabel}
              />
              <RatioCard
                label="ROE"
                value={formatPctV(roe)}
                valueColor={roe < 0 ? C.negative : C.textPrimary}
                delta={dPct(roe, prev?.roe_pct)}
                prevLabel={prevLabel}
              />
              <RatioCard
                label="EBITDA"
                value={formatM(totals.utilOper)}
                valueColor={valColor(totals.utilOper)}
                delta={last?.delta_util_oper_pct ?? null}
                prevLabel={prevLabel}
              />
            </div>

            {/* ROW 3 — Main chart + Balance */}
            <div
              className="grid gap-3 mt-3"
              style={{ gridTemplateColumns: "62fr 38fr" }}
            >
              {/* Main chart */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div style={{ fontSize: 10, color: C.textMuted }}>
                    Ingresos vs Margen operacional — por mes
                  </div>
                  <div className="flex items-center gap-3" style={{ fontSize: 10, color: C.textMuted }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: C.blueDark }} />
                      Ingresos
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          width: 12,
                          height: 0,
                          borderTop: `1.5px dashed ${C.positive}`,
                        }}
                      />
                      Margen %
                    </span>
                  </div>
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.blue} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={C.blueDark} stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="mes"
                        stroke={C.textDim}
                        fontSize={10}
                        tickLine={false}
                        axisLine={{ stroke: C.cardBorder }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke={C.textDim}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v.toFixed(0)}M`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke={C.textDim}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                      <Bar
                        yAxisId="left"
                        dataKey="ingresos"
                        name="Ingresos"
                        fill="url(#barGrad)"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="margen"
                        name="Margen %"
                        stroke={C.positive}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Balance stack */}
              <div className="flex flex-col gap-2">
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Balance general</div>
                  <BalanceRow
                    label="Activos"
                    value={formatM(totals.activos)}
                    badge="RC 0,8"
                    badgeColor={C.warning}
                  />
                  <BalanceRow
                    label="Pasivos"
                    value={formatM(totals.pasivos)}
                    badge={formatPctV(endeudamiento)}
                    badgeColor={C.negative}
                  />
                  <BalanceRow
                    label="Patrimonio"
                    value={formatM(totals.patrimonio)}
                    valueColor={totals.patrimonio < 0 ? C.negative : C.textPrimary}
                    badge={formatPctV(autonomia)}
                    badgeColor={autonomia < 0 ? C.negative : C.positive}
                  />
                </div>
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Ratios de solvencia</div>
                  <SolvRow label="Endeudamiento %" value={endeudamiento} good={(v) => v < 60} />
                  <SolvRow label="Autonomía %" value={autonomia} good={(v) => v > 30} />
                  <SolvRow label="ROE %" value={roe} good={(v) => v > 0} />
                </div>
              </div>
            </div>

            {/* ROW 4 — Bottom panels */}
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {/* Panel 1 — Bar mini */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Ingresos por mes</div>
                <div style={{ height: 90 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barMini" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.blue} />
                          <stop offset="100%" stopColor={C.blueDark} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="mes" stroke={C.textDim} fontSize={9} tickLine={false} axisLine={false} />
                      <Bar dataKey="ingresos" radius={[2, 2, 0, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill="url(#barMini)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Panel 2 — Distribución gastos */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Distribución de gastos</div>
                <DistRow label="G. Administración" pct={dist.adm} color={C.blue} />
                <DistRow label="G. Operacionales" pct={dist.oper} color={C.indigo} />
                <DistRow label="G. Financieros" pct={dist.fin} color={C.negative} />
                <DistRow label="Costos de venta" pct={dist.costos} color={C.warning} />
              </div>

              {/* Panel 3 — Top cuentas */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Top cuentas de ingreso</div>
                {topAgg.length === 0 ? (
                  <div style={{ fontSize: 10, color: C.textDim, padding: "8px 0" }}>Sin datos</div>
                ) : (
                  topAgg.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "3px 0",
                        borderBottom: i < topAgg.length - 1 ? `0.5px solid #0d1525` : "none",
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.nombre}
                      </span>
                      <span style={{ color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                        {formatM(r.valor)}
                      </span>
                      <span style={{ color: C.textDim, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>
                        {r.part.toFixed(1)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function BalanceRow({
  label,
  value,
  valueColor,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 13, color: valueColor ?? C.textPrimary, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
          {value}
        </span>
        <span
          style={{
            fontSize: 9,
            color: badgeColor,
            background: `${badgeColor}1f`,
            border: `0.5px solid ${badgeColor}55`,
            padding: "1px 6px",
            borderRadius: 999,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}

function SolvRow({
  label,
  value,
  good,
}: {
  label: string;
  value: number;
  good: (v: number) => boolean;
}) {
  const color = good(value) ? C.positive : C.negative;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, color, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
        {formatPctV(value)}
      </span>
    </div>
  );
}

function DistRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between" style={{ fontSize: 10, color: C.textMuted }}>
        <span>{label}</span>
        <span style={{ color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}>{safe.toFixed(1)}%</span>
      </div>
      <div
        style={{
          marginTop: 3,
          height: 4,
          background: C.cardBorder,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${safe}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}