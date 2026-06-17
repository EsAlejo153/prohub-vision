import AppLayout from "@/components/layout/AppLayout";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useFiltros } from "@/context/FiltrosContext";
import { useKpisMesAMes, useDistribucionGastos, useBalanceFallback, type KpiMesRow } from "@/hooks/useDashboardPremium";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/external-supabase";
import { buildPeriodoRange } from "@/context/FiltrosContext";
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
const deltaColor = (v: number | null | undefined) => (v == null ? C.textDim : v >= 0 ? C.positive : C.negative);

// ===== Sparkline =====
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

function Sparkline({ values, color, gradId }: { values: number[]; color: string; gradId: string }) {
  if (values.length < 2) return null;
  const w = 80;
  const h = 36;
  const pad = 2;
  const max = Math.max(...values.map((v) => Math.abs(v))) || 1;
  const points: Array<[number, number]> = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v / max) * (h / 2 - pad) + h / 2),
  ]);
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
        minHeight: 100,
      }}
    >
      <div
        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textDim, fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
          color: valueColor ?? C.textPrimary,
          fontVariantNumeric: "tabular-nums",
          marginTop: 8,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: deltaColor(delta), fontVariantNumeric: "tabular-nums" }}>
        {deltaArrow(delta)} {delta == null ? "—" : `${Math.abs(delta).toFixed(1)}%`}
        {prevLabel && <span style={{ color: C.textDim }}> vs {prevLabel}</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "#4a5568" }}>{sub}</div>
      <Sparkline values={sparkValues} color={sparkColor} gradId={gradId} />
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
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
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

// ===== Hook: Cartera & Disponible desde v_esf_resumida =====
function useCarteraDisponible(filtros: any) {
  return useQuery({
    queryKey: ["cartera_disponible", filtros],
    queryFn: async () => {
      // Detectar último mes con datos de balance
      let qMes = supabase
        .from("v_esf_resumida")
        .select("año_mes_num")
        .not("año_mes_num", "is", null)
        .order("año_mes_num", { ascending: false })
        .limit(1);
      if (filtros.compania !== "Todas") qMes = qMes.eq("compania", filtros.compania);
      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) qMes = qMes.lte("año_mes_num", range.max).gte("año_mes_num", range.min);
      const { data: mesData } = await qMes;
      const ultimoMes = (mesData?.[0] as any)?.año_mes_num;
      if (!ultimoMes) return { caja: 0, bancos: 0, clientes: 0, ultimoMes: null };

      let q = supabase
        .from("v_esf_resumida")
        .select("concepto, valor_presentacion, compania")
        .eq("año_mes_num", ultimoMes)
        .eq("nivel", "Cuenta")
        .in("concepto", ["CAJA", "BANCOS", "CUENTAS DE AHORRO", "CLIENTES"]);
      if (filtros.compania !== "Todas") q = q.eq("compania", filtros.compania);
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as { concepto: string; valor_presentacion: number | null }[];
      const sumOf = (concepto: string) =>
        rows.filter((r) => r.concepto === concepto).reduce((s, r) => s + (Number(r.valor_presentacion) || 0), 0);

      return {
        caja: sumOf("CAJA"),
        bancos: sumOf("BANCOS") + sumOf("CUENTAS DE AHORRO"),
        clientes: sumOf("CLIENTES"),
        ultimoMes,
      };
    },
  });
}

// ===== Hook: Gastos por grupo PYG desde v_eri_resumida =====
function useGastosPorGrupoPyg(filtros: any) {
  return useQuery({
    queryKey: ["gastos_grupo_pyg", filtros],
    queryFn: async () => {
      const GRUPOS_GASTO = [
        "GASTOS DE ADMINISTRACIÓN",
        "GASTOS OPERACIONALES",
        "GASTOS FINANCIEROS",
        "GASTOS NO OPERACIONALES",
      ];

      let q = supabase
        .from("v_eri_resumida")
        .select("grupo_titulo, valor_pyg, compania, año_mes_num")
        .in("grupo_titulo", GRUPOS_GASTO)
        .eq("nivel", "Cuenta");

      const range = buildPeriodoRange(filtros.año, filtros.mes);
      if (range) q = q.gte("año_mes_num", range.min).lte("año_mes_num", range.max);

      if (filtros.compania === "Todas") {
        // Consolidar ambas compañías
      } else {
        q = q.eq("compania", filtros.compania);
      }

      const { data, error } = await q.limit(5000);
      if (error) throw error;

      // Agrupar por grupo_titulo sumando valor_pyg
      const map = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        const g = r.grupo_titulo ?? "OTROS";
        const v = Math.abs(Number(r.valor_pyg) || 0);
        map.set(g, (map.get(g) ?? 0) + v);
      }

      // También traer ingresos totales para calcular %
      let qIng = supabase
        .from("v_eri_resumida")
        .select("valor_pyg")
        .eq("grupo_titulo", "INGRESOS OPERACIONALES")
        .eq("nivel", "Cuenta");
      if (range) qIng = qIng.gte("año_mes_num", range.min).lte("año_mes_num", range.max);
      if (filtros.compania !== "Todas") qIng = qIng.eq("compania", filtros.compania);
      const { data: ingData } = await qIng.limit(5000);
      const totalIngresos = ((ingData ?? []) as any[]).reduce((s, r) => s + Math.abs(Number(r.valor_pyg) || 0), 0);

      const colores: Record<string, string> = {
        "GASTOS DE ADMINISTRACIÓN": C.blue,
        "GASTOS OPERACIONALES": C.indigo,
        "GASTOS FINANCIEROS": C.negative,
        "GASTOS NO OPERACIONALES": C.warning,
      };

      const labels: Record<string, string> = {
        "GASTOS DE ADMINISTRACIÓN": "G. Administración",
        "GASTOS OPERACIONALES": "G. Operacionales",
        "GASTOS FINANCIEROS": "G. Financieros",
        "GASTOS NO OPERACIONALES": "G. No Operacionales",
      };

      return GRUPOS_GASTO.map((g) => ({
        grupo: g,
        label: labels[g] ?? g,
        total: map.get(g) ?? 0,
        pct: totalIngresos > 0 ? ((map.get(g) ?? 0) / totalIngresos) * 100 : 0,
        color: colores[g] ?? C.textDim,
      }));
    },
  });
}

// ===== GaugeCard =====
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
  const cy = 38;
  const arcLen = Math.PI * r;
  return (
    <div
      style={{
        background: C.card2Bg,
        borderRadius: 8,
        padding: "8px 10px",
        textAlign: "center",
        border: `0.5px solid ${C.card2Border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="72" height="42" viewBox="0 0 72 42" style={{ display: "block", margin: "0 auto" }}>
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
          fontSize: 15,
          fontWeight: 700,
          color,
          marginTop: 0,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {safe.toFixed(1)}
        {unit}
      </div>
      <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{label}</div>
    </div>
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
    <div className="flex items-center justify-between py-2">
      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{label}</span>
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 17,
            color: valueColor ?? C.textPrimary,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 10,
            color: badgeColor,
            background: `${badgeColor}1f`,
            border: `0.5px solid ${badgeColor}55`,
            padding: "2px 7px",
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

function StructureBar({ activos, pasivos, patrimonio }: { activos: number; pasivos: number; patrimonio: number }) {
  const denom = Math.abs(activos) || Math.abs(pasivos) + Math.abs(patrimonio) || 1;
  const pasivosPct = (Math.abs(pasivos) / denom) * 100;
  const patrimonioPct = Math.max(0, (patrimonio / denom) * 100);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, color: C.textDim }}>
        <span>Estructura de financiación</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pasivosPct.toFixed(1)}% deuda</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "#1a2332", overflow: "hidden", display: "flex" }}>
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

function DistRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div style={{ marginBottom: 9 }}>
      <div className="flex items-center justify-between" style={{ color: C.textMuted }}>
        <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
        <span style={{ color: C.textPrimary, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {safe.toFixed(1)}%
        </span>
      </div>
      <div style={{ marginTop: 3, height: 6, background: C.cardBorder, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${safe}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ===== Tarjeta Cartera & Disponible =====
function CarteraCard({ filtros }: { filtros: any }) {
  const { data } = useCarteraDisponible(filtros);
  const disponible = (data?.caja ?? 0) + (data?.bancos ?? 0);
  const cartera = data?.clientes ?? 0;
  const total = disponible + cartera || 1;
  const dispPct = (disponible / total) * 100;
  const cartPct = (cartera / total) * 100;

  const mesLabel = data?.ultimoMes
    ? `${String(data.ultimoMes).slice(4, 6)}/${String(data.ultimoMes).slice(0, 4)}`
    : "—";

  return (
    <div
      style={{
        background: C.cardBg,
        border: `0.5px solid ${C.cardBorder}`,
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 12,
            color: C.textMuted,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Liquidez & Cartera
        </div>
        <span style={{ fontSize: 10, color: C.textDim }}>Al {mesLabel}</span>
      </div>

      {/* Disponible */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>Disponible (Caja + Bancos)</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.positive, fontVariantNumeric: "tabular-nums" }}>
            {formatM(disponible)}
          </span>
        </div>
        <div style={{ height: 6, background: C.cardBorder, borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{ width: `${Math.min(dispPct, 100)}%`, height: "100%", background: C.positive, borderRadius: 3 }}
          />
        </div>
        <div style={{ marginTop: 4, display: "flex", gap: 12 }}>
          <div style={{ fontSize: 10, color: C.textDim }}>
            Caja:{" "}
            <span style={{ color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatM(data?.caja ?? 0)}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            Bancos:{" "}
            <span style={{ color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatM(data?.bancos ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Cartera */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>Cartera (Clientes)</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.warning, fontVariantNumeric: "tabular-nums" }}>
            {formatM(cartera)}
          </span>
        </div>
        <div style={{ height: 6, background: C.cardBorder, borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{ width: `${Math.min(cartPct, 100)}%`, height: "100%", background: C.warning, borderRadius: 3 }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>
          {cartPct.toFixed(1)}% del activo corriente líquido
        </div>
      </div>

      {/* Ratio disponible/cartera */}
      <div
        style={{
          borderTop: `0.5px solid ${C.cardBorder}`,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 10, color: C.textDim }}>Total activo corriente líquido</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}>
          {formatM(total === 1 ? 0 : total)}
        </span>
      </div>
    </div>
  );
}

// ===== Tarjeta Gastos por grupo PYG =====
function GastosPygCard({ filtros, totalIngresos }: { filtros: any; totalIngresos: number }) {
  const { data: grupos = [] } = useGastosPorGrupoPyg(filtros);
  const totalGastos = grupos.reduce((s, g) => s + g.total, 0);

  return (
    <div
      style={{
        background: C.cardBg,
        border: `0.5px solid ${C.cardBorder}`,
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.textMuted,
          marginBottom: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Gastos por categoría
      </div>
      <div style={{ flex: "1 1 auto" }}>
        {grupos.map((g) => (
          <div key={g.grupo} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{g.label}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: C.textDim, fontVariantNumeric: "tabular-nums" }}>
                  {g.pct.toFixed(1)}% ing.
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: g.color, fontVariantNumeric: "tabular-nums" }}>
                  {formatM(g.total)}
                </span>
              </div>
            </div>
            <div style={{ height: 6, background: C.cardBorder, borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{ width: `${Math.min(g.pct, 100)}%`, height: "100%", background: g.color, borderRadius: 2 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: `0.5px solid ${C.cardBorder}`,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 10, color: C.textDim }}>Total gastos acumulados</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.negative, fontVariantNumeric: "tabular-nums" }}>
          {formatM(totalGastos)}
        </span>
      </div>
    </div>
  );
}

// ===== MAIN DASHBOARD =====
export default function Dashboard() {
  const filtros = useFiltros();
  const { data: rows = [], isLoading } = useKpisMesAMes(filtros);
  const { data: distRows = [] } = useDistribucionGastos(filtros);

  const last = rows.length ? rows[rows.length - 1] : null;
  const prevLabel = rows.length >= 2 ? rows[rows.length - 2].mes_label : null;

  const totals = useMemo(() => {
    const sum = (k: keyof KpiMesRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return {
      ingresos: sum("ingresos"),
      utilOper: sum("utilidad_operacional"),
      utilNeta: sum("utilidad_neta"),
    };
  }, [rows]);

  const { data: balFallback } = useBalanceFallback(filtros, true);
  const balance =
    balFallback && (balFallback.activos !== 0 || balFallback.pasivos !== 0 || balFallback.patrimonio !== 0)
      ? balFallback
      : { activos: 0, pasivos: 0, patrimonio: 0 };

  const sparks = useMemo(
    () => ({
      ingresos: rows.map((r) => Number(r.ingresos) || 0),
      utilOper: rows.map((r) => Number(r.utilidad_operacional) || 0),
      utilNeta: rows.map((r) => Number(r.utilidad_neta) || 0),
    }),
    [rows],
  );

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        mes_label: r.mes_label,
        ingresos: Number(r.ingresos) || 0,
        margen_operacional_pct: Math.max(-100, Math.min(100, Number(r.margen_operacional_pct) || 0)),
      })),
    [rows],
  );

  const dist = useMemo(() => {
    if (!distRows.length) return { adm: 0, oper: 0, fin: 0, costos: 0 };
    const avg = (k: keyof (typeof distRows)[number]) =>
      distRows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / distRows.length;
    return { adm: avg("pct_adm"), oper: avg("pct_oper"), fin: avg("pct_fin"), costos: avg("pct_costos") };
  }, [distRows]);

  const valColor = (v: number) => (v < 0 ? C.negative : C.positive);
  const margenBruto = last?.margen_bruto_pct ?? 0;
  const margenNeto = last?.margen_neto_pct ?? 0;
  const costoIngreso = last?.costo_ingreso_pct ?? 0;

  const safeDiv = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);
  const endeudamiento =
    balance.activos !== 0
      ? safeDiv(Math.abs(balance.pasivos), Math.abs(balance.activos))
      : (last?.endeudamiento_pct ?? 0);
  const autonomia =
    balance.activos !== 0 ? safeDiv(balance.patrimonio, Math.abs(balance.activos)) : (last?.autonomia_pct ?? 0);
  const roe = balance.patrimonio !== 0 ? safeDiv(totals.utilNeta, Math.abs(balance.patrimonio)) : (last?.roe_pct ?? 0);
  const roa = balance.activos !== 0 ? safeDiv(totals.utilNeta, Math.abs(balance.activos)) : (last?.roa_pct ?? 0);

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
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxSizing: "border-box",
        }}
      >
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            <Skel />
            <Skel />
            <Skel />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background: C.cardBg, border: `0.5px solid ${C.cardBorder}`, borderRadius: 8 }}>
            <EmptyMsg />
          </div>
        ) : (
          <>
            {/* ── ROW 1: Hero KPIs ── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <HeroCard
                label="Ingresos operativos"
                value={formatM(totals.ingresos)}
                delta={last?.delta_ingresos_pct ?? null}
                prevLabel={prevLabel}
                sub={`Acumulado ${rows[0]?.mes_label}–${last?.mes_label} ${filtros.año === "Todas" ? "2026" : filtros.año}`}
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
                sparkColor={totals.utilOper < 0 ? C.negative : C.positive}
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
                sparkColor={totals.utilNeta < 0 ? C.negative : C.positive}
                gradId="sp-un"
              />
            </div>

            {/* ── ROW 2: 4 Ratios (sin ROE duplicado) ── */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
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
                label="EBITDA"
                value={formatM(totals.utilOper)}
                valueColor={valColor(totals.utilOper)}
                delta={last?.delta_util_oper_pct ?? null}
                prevLabel={prevLabel}
              />
            </div>

            {/* ── ROW 3: Gráfico principal + Balance & Solvencia ── */}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "62fr 38fr",
                height: "clamp(300px, calc(100vh - 400px), 460px)",
                minHeight: 300,
              }}
            >
              {/* Gráfico */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
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
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.card2Border} vertical={false} />
                      <XAxis
                        dataKey="mes_label"
                        tick={{ fontSize: 9, fill: C.textDim }}
                        axisLine={false}
                        tickLine={false}
                      />
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

              {/* Balance + Solvencia apilados */}
              <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
                {/* Balance */}
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                    flex: "0 0 auto",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      marginBottom: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Balance general
                  </div>
                  <BalanceRow
                    label="Activos"
                    value={formatM(balance.activos)}
                    badge="Activo total"
                    badgeColor={C.blue}
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

                {/* Ratios Solvencia */}
                <div
                  style={{
                    background: C.cardBg,
                    border: `0.5px solid ${C.cardBorder}`,
                    borderRadius: 8,
                    padding: 12,
                    flex: "1 1 auto",
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      marginBottom: 6,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Ratios de solvencia
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    <GaugeCard
                      label="Endeudamiento"
                      value={endeudamiento}
                      unit="%"
                      min={0}
                      max={200}
                      threshold={100}
                      colorOk={C.positive}
                      colorBad={C.negative}
                    />
                    <GaugeCard
                      label="Autonomía"
                      value={autonomia}
                      unit="%"
                      min={-100}
                      max={100}
                      threshold={0}
                      colorOk={C.positive}
                      colorBad={C.negative}
                      invert
                    />
                    <GaugeCard
                      label="ROE"
                      value={roe}
                      unit="%"
                      min={-20}
                      max={20}
                      threshold={0}
                      colorOk={C.positive}
                      colorBad={C.negative}
                      invert
                    />
                    <GaugeCard
                      label="ROA"
                      value={roa}
                      unit="%"
                      min={-20}
                      max={20}
                      threshold={0}
                      colorOk={C.positive}
                      colorBad={C.negative}
                      invert
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 4: Liquidez & Cartera | Gastos por categoría PYG | Distribución % ── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {/* Tarjeta 1: Liquidez & Cartera */}
              <CarteraCard filtros={filtros} />

              {/* Tarjeta 2: Gastos por categoría PYG */}
              <GastosPygCard filtros={filtros} totalIngresos={totals.ingresos} />

              {/* Tarjeta 3: Distribución de gastos % */}
              <div
                style={{
                  background: C.cardBg,
                  border: `0.5px solid ${C.cardBorder}`,
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: C.textMuted,
                    marginBottom: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Distribución de gastos
                </div>
                <div style={{ flex: "1 1 auto" }}>
                  <DistRow label="G. Administración" pct={dist.adm} color={C.blue} />
                  <DistRow label="G. Operacionales" pct={dist.oper} color={C.indigo} />
                  <DistRow label="G. Financieros" pct={dist.fin} color={C.negative} />
                  <DistRow label="Costos de venta" pct={dist.costos} color={C.warning} />
                </div>
                <div
                  style={{
                    borderTop: `0.5px solid ${C.cardBorder}`,
                    paddingTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 10, color: C.textDim }}>Total egresos acumulados</span>
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatM(Math.max(0, totals.ingresos - totals.utilOper))}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
