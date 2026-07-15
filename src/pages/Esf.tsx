import { Fragment, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import AppLayout from "@/components/layout/AppLayout";
import { useFiltros } from "@/context/FiltrosContext";
import { useEsf, useMesesEsf, usePlanEsf, cargarAuxiliarEsf } from "@/hooks/useEsf";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoadingSkeleton, ErrorState } from "@/components/dashboard/StateMessages";
import { Upload } from "lucide-react";

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(yyyymm: number) {
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  return `${MES_LABELS[m - 1] ?? m} ${y}`;
}

function fmtCOP(v: number | null | undefined): { text: string; neg: boolean; zero: boolean } {
  if (v == null || !Number.isFinite(v) || v === 0) return { text: "-", neg: false, zero: true };
  if (v < 0)
    return {
      text: `(${Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 0 })})`,
      neg: true,
      zero: false,
    };
  return { text: v.toLocaleString("es-CO", { maximumFractionDigits: 0 }), neg: false, zero: false };
}

export default function Esf() {
  const filtros = useFiltros();
  const qc = useQueryClient();
  const { data: meses = [] } = useMesesEsf(filtros.compania);
  const { data: planEsf = [] } = usePlanEsf();

  const [mesSelec, setMesSelec] = useState<number | null>(null);
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(
    new Set([
      "DISPONIBLE",
      "DEUDORES",
      "INVENTARIOS",
      "PROVEEDORES",
      "CUENTAS POR PAGAR",
      "IMPUESTOS",
      "OBLIGACIONES LABORALES",
      "OTROS PASIVOS",
      "RESULTADOS DEL EJERCICIO",
    ]),
  );
  const [openSecciones, setOpenSecciones] = useState<Set<string>>(new Set(["ACTIVO", "PASIVO", "PATRIMONIO"]));
  const [cargando, setCargando] = useState(false);

  const mesActivo = mesSelec ?? meses[0] ?? null;

  const {
    data: esfData = [],
    isLoading,
    isError,
  } = useEsf({
    año_mes_num: mesActivo,
    compania: filtros.compania,
  });

  const togSec = (k: string) =>
    setOpenSecciones((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });
  const togGrupo = (k: string) =>
    setOpenGrupos((p) => {
      const s = new Set(p);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });

  // Mapa de valores por orden
  const valorMap = useMemo(() => {
    const m = new Map<number, number>();
    // Suma en vez de sobreescribir: si alguna vez llegan varias filas para el
    // mismo "orden" (por ejemplo si se agrega una nueva compañía y useEsf no
    // filtra correctamente), esto evita que una tape a la otra en silencio.
    for (const r of esfData) m.set(r.orden, (m.get(r.orden) ?? 0) + (r.valor_presentacion ?? 0));
    return m;
  }, [esfData]);

  // Calcular totales de grupo
  const totalGrupo = (grupoTitulo: string, seccion: string): number =>
    planEsf
      .filter((r) => r.nivel === "Cuenta" || r.nivel === "CuentaERI")
      .filter((r) => r.grupo_titulo === grupoTitulo && r.seccion === seccion)
      .reduce((s, r) => s + (valorMap.get(r.orden) ?? 0), 0);

  // Calcular total sección
  const totalSeccion = (seccion: string): number =>
    planEsf
      .filter((r) => (r.nivel === "Cuenta" || r.nivel === "CuentaERI") && r.seccion === seccion)
      .reduce((s, r) => s + (valorMap.get(r.orden) ?? 0), 0);

  const totalActivo = totalSeccion("ACTIVO");
  const totalPasivo = totalSeccion("PASIVO");
  const totalPatrimonio = totalSeccion("PATRIMONIO");
  const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;

  // Grupos únicos por sección en orden
  const gruposPorSeccion = useMemo(() => {
    const map = new Map<string, Array<{ grupo: string; seccion: string; orden: number }>>();
    for (const r of planEsf) {
      if (r.nivel !== "Grupo") continue;
      if (!map.has(r.seccion)) map.set(r.seccion, []);
      map.get(r.seccion)!.push({ grupo: r.concepto, seccion: r.seccion, orden: r.orden });
    }
    return map;
  }, [planEsf]);

  // Cuentas por grupo
  const cuentasPorGrupo = useMemo(() => {
    const map = new Map<string, typeof planEsf>();
    for (const r of planEsf) {
      if (r.nivel !== "Cuenta" && r.nivel !== "CuentaERI") continue;
      const key = `${r.seccion}||${r.grupo_titulo}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [planEsf]);

  // Cargar Excel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mesActivo) return;
    setCargando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });

      const filas = rows
        .filter((r) => r["CUENTA"] && String(r["CUENTA"]).match(/^\d/))
        .map((r) => ({
          cuenta_key: String(r["CUENTA"] ?? "").trim(),
          nombre_cuenta: String(r["NOMBRE"] ?? r["nombre"] ?? "").trim(),
          saldo_anterior: Number(r["SALDO ANTERIOR"] ?? r["saldo_anterior"] ?? 0),
          debito: Number(r["DEBITO"] ?? r["debito"] ?? 0),
          credito: Number(r["CREDITO"] ?? r["credito"] ?? 0),
          saldo_final: Number(r["SALDO FINAL"] ?? r["saldo_final"] ?? 0),
        }))
        .filter((r) => r.cuenta_key !== "" && ["1", "2", "3"].includes(r.cuenta_key.slice(0, 1)));

      const result = await cargarAuxiliarEsf({
        filas,
        compania: filtros.compania === "Todas" ? "PROHUB" : filtros.compania,
        año_mes_num: mesActivo,
        nombre_archivo: `ESF_${file.name}`,
      });

      toast.success(`${result?.insertadas ?? filas.length} cuentas cargadas correctamente`);
      await qc.invalidateQueries({ queryKey: ["esf"] });
      await qc.invalidateQueries({ queryKey: ["esf-meses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setCargando(false);
      e.target.value = "";
    }
  };

  const CV = ({ v }: { v: number }) => {
    const f = fmtCOP(v);
    return (
      <td
        className={`px-3 py-1 text-right tabular-nums ${
          f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"
        }`}
      >
        {f.text}
      </td>
    );
  };

  const SeccionHeader = ({ label, seccion }: { label: string; seccion: string }) => (
    <tr className="cursor-pointer border-b border-border bg-card" onClick={() => togSec(seccion)}>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
          <span className="text-[10px] text-muted-foreground">{openSecciones.has(seccion) ? "▼" : "▶"}</span>
          {label}
        </span>
      </td>
      <td className="px-3 py-2" />
    </tr>
  );

  const GrupoHeader = ({ grupo, seccion }: { grupo: string; seccion: string }) => {
    const tot = totalGrupo(grupo, seccion);
    const f = fmtCOP(tot);
    const key = `${seccion}||${grupo}`;
    return (
      <tr className="cursor-pointer border-b border-border/40 bg-muted/30" onClick={() => togGrupo(key)}>
        <td className="px-3 py-1.5 pl-6">
          <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground/90">
            <span className="text-[10px] text-muted-foreground">{openGrupos.has(key) ? "▾" : "▸"}</span>
            {grupo}
          </span>
        </td>
        <td
          className={`px-3 py-1.5 text-right text-[11px] font-semibold tabular-nums ${
            f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground/90"
          }`}
        >
          {f.text}
        </td>
      </tr>
    );
  };

  const TotalRow = ({ label, valor, highlight = false }: { label: string; valor: number; highlight?: boolean }) => {
    const f = fmtCOP(valor);
    return (
      <tr
        className="border-b border-border"
        style={{
          background: highlight ? (valor >= 0 ? "#0d2040" : "#2d1a1a") : valor >= 0 ? "#1a2d1a" : "#2d1a1a",
        }}
      >
        <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-foreground">{label}</td>
        <td
          className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${
            f.neg ? "text-destructive" : "text-foreground"
          }`}
        >
          {f.text}
        </td>
      </tr>
    );
  };

  const secciones = ["ACTIVO", "PASIVO", "PATRIMONIO"];

  return (
    <AppLayout title="Estado de Situación Financiera">
      {/* Header: selector de mes + carga */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {meses.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin datos cargados aún</span>
          ) : (
            meses.map((m) => (
              <button
                key={m}
                onClick={() => setMesSelec(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mesActivo === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {mesLabel(m)}
              </button>
            ))
          )}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
          {cargando ? "Cargando..." : "Cargar auxiliar"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
            disabled={cargando || !mesActivo}
          />
        </label>
      </div>

      {!mesActivo ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <div className="text-4xl">📊</div>
          <p className="text-sm font-medium text-foreground">Carga un auxiliar de balance para comenzar</p>
          <p className="text-xs text-muted-foreground">Formatos soportados: .xlsx, .xls</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState />
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="min-w-[280px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {mesActivo ? mesLabel(mesActivo) : "—"}
                </th>
              </tr>
            </thead>
            <tbody>
              {secciones.map((seccion) => {
                const grupos = gruposPorSeccion.get(seccion) ?? [];
                return (
                  <Fragment key={seccion}>
                    <SeccionHeader label={seccion} seccion={seccion} />
                    {openSecciones.has(seccion) &&
                      grupos.map(({ grupo }) => {
                        const key = `${seccion}||${grupo}`;
                        const cuentas = cuentasPorGrupo.get(key) ?? [];
                        return (
                          <Fragment key={key}>
                            <GrupoHeader grupo={grupo} seccion={seccion} />
                            {openGrupos.has(key) &&
                              cuentas.map((c) => {
                                const v = valorMap.get(c.orden) ?? 0;
                                return (
                                  <tr key={c.orden} className="border-b border-border/10">
                                    <td className="px-3 py-1 pl-12 text-[11px] text-muted-foreground/80">
                                      {c.concepto}
                                    </td>
                                    <CV v={v} />
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    {seccion === "ACTIVO" && <TotalRow label="TOTAL ACTIVO" valor={totalActivo} highlight />}
                    {seccion === "PASIVO" && <TotalRow label="TOTAL PASIVO" valor={totalPasivo} />}
                    {seccion === "PATRIMONIO" && (
                      <>
                        <TotalRow label="TOTAL PATRIMONIO" valor={totalPatrimonio} />
                        <TotalRow label="TOTAL PASIVO + PATRIMONIO" valor={totalPasivoPatrimonio} highlight />
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
