import AppLayout from "@/components/layout/AppLayout";
import {
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useFiltros } from "@/context/FiltrosContext";
import {
  useKpisMesAMes,
  useDistribucionGastos,
  useTopCuentas,
  useBalanceFallback,
  type KpiMesRow,
} from "@/hooks/useDashboardPremium";
import { useMemo } from "react";
import { AlertCircle } from "lucide-react";

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

// ===== Smooth sparkline (catmull-rom spline -> bezier) =====
function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const d: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2[0]} ${p2[1]}`);
  }
  return d.join(" ");
}

function Sparkline({
  values,
  color,
  gradId,
}: {
  values: number[];
  color: string;
  gradId: string;
}) {
  if (values.length < 2) return null;
  const w = 80;
  const h = 36;
  const pad = 2;
  const max = Math.max(...values.map((v) => Math.abs(v))) || 1;
  const points: Array<[number, number]> = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    // Map sign-aware: positive up, negative down, baseline center.
    const y = h - ((v / max) * (h / 2 - pad) + h / 2);
    return [x, y];
  });
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", bottom: 0, right: 0, opacity: 0.9, pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
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
  sparkColor,
  gradId,
}: {
  label: string;
  value: string;
  delta: number | null;
  prevLabel: string | null;
  sub: string;
  sparkValues: number[];
  highlight?: boolean;
  valueColor?: string;
  sparkColor: string;
  gradId: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: C.cardBg,
        border: `0.5px solid ${highlight ? C.blueDark : C.cardBorder}`,
        borderRadius: 8,
          padding: 14,
        overflow: "hidden",
          display: "flex",
          flexDirection: "column",
      }}
    >
      <div
        style={{
            fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: C.textDim,
            fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1,
          color: valueColor ?? C.textPrimary,
          fontVariantNumeric: "tabular-nums",
            marginTop: 8,
        }}
      >
        {value}
      </div>
      <div
        style={{
            marginTop: 6,
            fontSize: 11,
          color: deltaColor(delta),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {deltaArrow(delta)} {delta == null ? "—" : `${Math.abs(delta).toFixed(1)}%`}
        {prevLabel && <span style={{ color: C.textDim }}> vs {prevLabel}</span>}
      </div>
        <div style={{ marginTop: 6, fontSize: 10, color: "#4a5568" }}>{sub}</div>
      <Sparkline values={sparkValues} color={sparkColor} gradId={gradId} />
    </div>
  );
}

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
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: valueColor ?? C.textPrimary,
          fontVariantNumeric: "tabular-nums",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: deltaColor(delta), marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {deltaArrow(delta)} {delta == null ? "—" : `${Math.abs(delta).toFixed(1)}%`}
        {prevLabel && <span style={{ color: C.textDim }}> vs {prevLabel}</span>}
      </div>
    </div>
  );
}

function Skel() {
  return (
    <div
      className="animate-pulse"
      style={{ background: C.cardBg, border: `0.5px solid ${C.cardBorder}`, borderRadius: 8, height: 110 }}
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

export default function Dashboard() {
  const filtros = useFiltros();
  const { data: rows = [], isLoading } = useKpisMesAMes(filtros);
  const { data: distRows = [] } = useDistribucionGastos(filtros);
  const { data: topRows = [] } = useTopCuentas(filtros);

  const last = rows.length ? rows[rows.length - 1] : null;
  const prevLabel = rows.length >= 2 ? rows[rows.length - 2].mes_label : null;

  // Aggregates from kpis-mes-a-mes
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

  // Always query movimientos directly for balance (more reliable than view aggregates)
  const { data: balFallback } = useBalanceFallback(filtros, true);
  const balance = balFallback && (balFallback.activos !== 0 || balFallback.pasivos !== 0 || balFallback.patrimonio !== 0)
    ? balFallback
    : { activos: totals.activos, pasivos: totals.pasivos, patrimonio: totals.patrimonio };

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
        mes_label: r.mes_label,
        ingresos: Number(r.ingresos) || 0,
        margen_operacional_pct: Number(r.margen_operacional_pct) || 0,
      })),
    [rows]
  );

  // Distribución gastos averaged across filtered months
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

  // Top cuentas — group by cuenta_key (with fallbacks to cuenta_codigo)
  const topAgg = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number }>();
    for (const r of topRows as any[]) {
      const key = r.cuenta_key ?? r.cuenta_codigo ?? r.nombre_cuenta ?? r.cuenta_nombre ?? "—";
      const nombre = r.nombre_cuenta ?? r.cuenta_nombre ?? String(key);
      const valor = Number(r.total ?? r.valor ?? 0) || 0;
      const ex = map.get(key);
      if (ex) ex.total += valor;
      else map.set(key, { nombre, total: valor });
    }
    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    const grand = arr.reduce((s, r) => s + r.total, 0);
    return arr.map((r) => ({ ...r, part: grand > 0 ? (r.total / grand) * 100 : 0 }));
  }, [topRows]);

  const valColor = (v: number) => (v < 0 ? C.negative : C.positive);
  const sparkUtilOperColor = totals.utilOper < 0 ? C.negative : C.positive;
  const sparkUtilNetaColor = totals.utilNeta < 0 ? C.negative : C.positive;

  const margenBruto = last?.margen_bruto_pct ?? 0;
  const margenNeto = last?.margen_neto_pct ?? 0;
  const costoIngreso = last?.costo_ingreso_pct ?? 0;
  // Derive from balance directly (avoids $0 from view)
  const safeDiv = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);
  const endeudamiento = balance.activos !== 0
    ? safeDiv(Math.abs(balance.pasivos), Math.abs(balance.activos))
    : last?.endeudamiento_pct ?? 0;
  const autonomia = balance.activos !== 0
    ? safeDiv(balance.patrimonio, Math.abs(balance.activos))
    : last?.autonomia_pct ?? 0;
  const roe = balance.patrimonio !== 0
    ? safeDiv(totals.utilNeta, Math.abs(balance.patrimonio))
    : last?.roe_pct ?? 0;
  const roa = balance.activos !== 0
    ? safeDiv(totals.utilNeta, Math.abs(balance.activos))
    : last?.roa_pct ?? 0;

  const clampedChartData = useMemo(
    () =>
      chartData.map((d) => ({
        ...d,
        margen_operacional_pct: Math.max(-100, Math.min(100, d.margen_operacional_pct)),
      })),
    [chartData]
  );

  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const dPct = (curr: number, prv: number | undefined) =>
    prv == null || prv === 0 ? null : ((curr - prv) / Math.abs(prv)) * 100;

  return (
    <AppLayout title="Dashboard Financiero">
      <div
        style={{
          background: C.pageBg,
          margin: -24,
          padding: 16,
          display: "grid",
          gridTemplateRows: "auto auto auto 1fr",
          gap: 8,
          height: "calc(100vh - 56px)",
          overflow: "hidden",
        }}
      >
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
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", flex: "0 0 auto" }}>
              <HeroCard
                label="Ingresos operativos"
                value={formatM(totals.ingresos)}
                delta={last?.delta_ingresos_pct ?? null}
                prevLabel={prevLabel}
                sub={`Acumulado ${rows[0]?.mes_label}–${last?.mes_label} ${filtros.año === "Todas" ? "" : filtros.año}`}
                sparkValues={sparks.ingresos}
                sparkColor={C.blue}
                gradId="sp-ing"
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
                sparkColor={sparkUtilOperColor}
                gradId="sp-uo"
              />
              <HeroCard
                label="Utilidad neta"
                value={formatM(totals.utilNeta)}
                valueColor={valColor(totals.utilNeta)}
                delta={last?.delta_util_neta_pct ?? null}
                prevLabel={prevLabel}
                sub="Después de gastos financieros"
                sparkValues={sparks.utilNeta}
                sparkColor={sparkUtilNetaColor}
                gradId="sp-un"
              />
            </div>

            {/* ROW 2 — Ratios */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", flex: "0 0 auto" }}>
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
            <div className="grid gap-3" style={{ gridTemplateColumns: "62fr 38fr", flex: "1 1 auto", minHeight: 0 }}>
              {/* Main area chart */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: 0,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div style={{ fontSize: 10, color: C.textMuted }}>
                    Ingresos vs Margen operacional — por mes
                  </div>
                  <div className="flex items-center gap-3" style={{ fontSize: 10, color: C.textMuted }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: C.blue }} />
                      Ingresos
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 12, height: 0, borderTop: `1.5px dashed ${C.positive}` }} />
                      Margen %
                    </span>
                  </div>
                </div>
                <div style={{ flex: "1 1 auto", minHeight: 0 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={clampedChartData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.card2Border} vertical={false} />
                    <XAxis dataKey="mes_label" tick={{ fontSize: 9, fill: C.textDim }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 9, fill: C.textDim }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[-100, 100]}
                      tick={{ fontSize: 9, fill: C.textDim }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: `1px solid ${C.cardBorder}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: C.textPrimary }}
                      itemStyle={{ color: C.textMuted }}
                      formatter={(value: number, name: string) => {
                        if (name === "margen_operacional_pct") return [`${Number(value).toFixed(1)}%`, "Margen %"];
                        return [formatM(Number(value)), "Ingresos"];
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="ingresos"
                      stroke={C.blue}
                      strokeWidth={2}
                      fill="url(#gradIngresos)"
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="margen_operacional_pct"
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
              <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                    flex: "1 1 auto",
                  }}
                >
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Balance general</div>
                  <BalanceRow
                    label="Activos"
                    value={formatM(balance.activos)}
                    badge="RC 0,8"
                    badgeColor={C.warning}
                  />
                  <BalanceRow
                    label="Pasivos"
                    value={formatM(balance.pasivos)}
                    badge={formatPctV(endeudamiento)}
                    badgeColor={C.negative}
                  />
                  <BalanceRow
                    label="Patrimonio"
                    value={formatM(balance.patrimonio)}
                    valueColor={balance.patrimonio < 0 ? C.negative : C.textPrimary}
                    badge={formatPctV(autonomia)}
                    badgeColor={autonomia < 0 ? C.negative : C.positive}
                  />
                  <StructureBar activos={balance.activos} pasivos={balance.pasivos} patrimonio={balance.patrimonio} />
                </div>
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                    flex: "1 1 auto",
                  }}
                >
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Ratios de solvencia</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <GaugeCard label="Endeudamiento" value={endeudamiento} unit="%" min={0} max={200} threshold={100} colorOk={C.positive} colorBad={C.negative} />
                    <GaugeCard label="Autonomía" value={autonomia} unit="%" min={-100} max={100} threshold={0} colorOk={C.positive} colorBad={C.negative} invert />
                    <GaugeCard label="ROE" value={roe} unit="%" min={-20} max={20} threshold={0} colorOk={C.positive} colorBad={C.negative} invert />
                    <GaugeCard label="ROA" value={roa} unit="%" min={-20} max={20} threshold={0} colorOk={C.positive} colorBad={C.negative} invert />
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 4 — Bottom panels */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", flex: "0 0 220px", marginBottom: 0, alignItems: "stretch" }}>
              {/* Mini area chart */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Ingresos por mes</div>
                <div style={{ flex: 1, minHeight: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradMini" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="ingresos"
                      stroke={C.blue}
                      strokeWidth={2}
                      fill="url(#gradMini)"
                      dot={false}
                    />
                    <XAxis
                      dataKey="mes_label"
                      tick={{ fontSize: 8, fill: "#4a5568" }}
                      axisLine={false}
                      tickLine={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Distribución gastos */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 14,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>Distribución de gastos</div>
                <div style={{ flex: "1 1 auto" }}>
                  <DistRow label="G. Administración" pct={dist.adm} color={C.blue} />
                  <DistRow label="G. Operacionales" pct={dist.oper} color={C.indigo} />
                  <DistRow label="G. Financieros" pct={dist.fin} color={C.negative} />
                  <DistRow label="Costos de venta" pct={dist.costos} color={C.warning} />
                </div>
              </div>

              {/* Top cuentas */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
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
                        gridTemplateColumns: "1.4fr 1fr auto auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: i < topAgg.length - 1 ? `0.5px solid #0d1525` : "none",
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          color: C.textMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.nombre}
                      </span>
                      <div style={{ height: 4, background: "#0d1525", borderRadius: 2, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, r.part))}%`,
                            height: "100%",
                            background: C.blue,
                            borderRadius: 2,
                          }}
                        />
                      </div>
                      <span style={{ color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                        {formatM(r.total)}
                      </span>
                      <span
                        style={{
                          color: C.textDim,
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 36,
                          textAlign: "right",
                        }}
                      >
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
        <span
          style={{
            fontSize: 13,
            color: valueColor ?? C.textPrimary,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
          }}
        >
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
    <div style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-between" style={{ fontSize: 11, color: C.textMuted }}>
        <span>{label}</span>
        <span style={{ color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}>{safe.toFixed(1)}%</span>
      </div>
      <div
        style={{
          marginTop: 4,
          height: 6,
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

function StructureBar({ activos, pasivos, patrimonio }: { activos: number; pasivos: number; patrimonio: number }) {
  const denom = Math.abs(activos) || Math.abs(pasivos) + Math.abs(patrimonio) || 1;
  const pasivosPct = (Math.abs(pasivos) / denom) * 100;
  const patrimonioPct = Math.max(0, (patrimonio / denom) * 100);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, color: C.textDim }}>
        <span>Estructura de financiación</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pasivosPct.toFixed(1)}% deuda</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#1a2332", overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${Math.min(pasivosPct, 100)}%`, background: C.negative, transition: "width 0.5s" }} />
        <div style={{ width: `${Math.min(patrimonioPct, 100)}%`, background: C.positive, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: C.negative }}>● Pasivos</span>
        <span style={{ fontSize: 9, color: C.positive }}>● Patrimonio</span>
      </div>
    </div>
  );
}

function GaugeCard({
  label,
  value,
  unit,
  min,
  max,
  threshold,
  colorOk,
  colorBad,
  invert,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  threshold: number;
  colorOk: string;
  colorBad: string;
  invert?: boolean;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.min(Math.max((safe - min) / (max - min), 0), 1);
  const angle = pct * 180 - 90;
  const isGood = invert ? safe >= threshold : safe <= threshold;
  const color = isGood ? colorOk : colorBad;
  const r = 28;
  const cx = 36;
  const cy = 36;
  const arcLen = Math.PI * r;
  return (
    <div
      style={{
        background: C.card2Bg,
        borderRadius: 8,
        padding: "10px 8px",
        textAlign: "center",
        border: `0.5px solid ${C.card2Border}`,
      }}
    >
      <svg width="72" height="40" viewBox="0 0 72 40" style={{ display: "block", margin: "0 auto" }}>
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none"
          stroke="#1a2332"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${pct * arcLen} ${arcLen}`}
        />
        <circle
          cx={cx + r * Math.cos((angle * Math.PI) / 180)}
          cy={cy - r * Math.sin((angle * Math.PI) / 180)}
          r={3}
          fill={color}
        />
      </svg>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color,
          marginTop: -2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {safe.toFixed(1)}
        {unit}
      </div>
      <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{label}</div>
    </div>
  );
}