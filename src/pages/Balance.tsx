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
    return { text: `(${Math.abs(v).toLocaleString("es-CO", { maximumFractionDigits: 0 })})`, neg: true, zero: false };
  return { text: v.toLocaleString("es-CO", { maximumFractionDigits: 0 }), neg: false, zero: false };
}

export default function Balance() {
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

  const valorMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of esfData) m.set(r.orden, r.valor_presentacion ?? 0);
    return m;
  }, [esfData]);

  const totalGrupo = (grupoTitulo: string, seccion: string): number =>
    planEsf
      .filter((r) => r.nivel === "Cuenta" || r.nivel === "CuentaERI")
      .filter((r) => r.grupo_titulo === grupoTitulo && r.seccion === seccion)
      .reduce((s, r) => s + (valorMap.get(r.orden) ?? 0), 0);

  const totalSeccion = (seccion: string): number =>
    planEsf
      .filter((r) => (r.nivel === "Cuenta" || r.nivel === "CuentaERI") && r.seccion === seccion)
      .reduce((s, r) => s + (valorMap.get(r.orden) ?? 0), 0);

  const totalActivo = totalSeccion("ACTIVO");
  const totalPasivo = totalSeccion("PASIVO");
  const totalPatrimonio = totalSeccion("PATRIMONIO");
  const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;

  const gruposPorSeccion = useMemo(() => {
    const map = new Map<string, Array<{ grupo: string; seccion: string; orden: number }>>();
    for (const r of planEsf) {
      if (r.nivel !== "Grupo") continue;
      if (!map.has(r.seccion)) map.set(r.seccion, []);
      map.get(r.seccion)!.push({ grupo: r.concepto, seccion: r.seccion, orden: r.orden });
    }
    return map;
  }, [planEsf]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("Primero selecciona un mes");
      return;
    }
    setCargando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });

      // Detectar mes desde el nombre del archivo o usar el activo
      let añoMes = mesActivo;
      if (!añoMes) {
        // Intentar extraer YYYYMM del nombre del archivo
        const match = file.name.match(/(\d{4})[-_]?(\d{2})/);
        if (match) añoMes = parseInt(`${match[1]}${match[2]}`);
        else {
          toast.error("No se pudo detectar el mes. Selecciona un mes primero.");
          setCargando(false);
          return;
        }
      }

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

      if (filas.length === 0) {
        toast.error("No se encontraron cuentas de balance (clase 1, 2 o 3) en el archivo");
        return;
      }

      const result = await cargarAuxiliarEsf({
        filas,
        compania: filtros.compania === "Todas" ? "PROHUB" : filtros.compania,
        año_mes_num: añoMes,
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
        className={`whitespace-nowrap px-4 py-1 text-right tabular-nums text-[12px] ${f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"}`}
      >
        {f.text}
      </td>
    );
  };

  const SeccionHeader = ({ label, seccion }: { label: string; seccion: string }) => (
    <tr className="cursor-pointer" style={{ background: "#1e2d42" }} onClick={() => togSec(seccion)}>
      <td colSpan={2} className="px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-foreground">
        <span className="mr-2 text-[10px] text-muted-foreground">{openSecciones.has(seccion) ? "▼" : "▶"}</span>
        {label}
      </td>
    </tr>
  );

  const GrupoHeader = ({ grupo, seccion }: { grupo: string; seccion: string }) => {
    const tot = totalGrupo(grupo, seccion);
    const f = fmtCOP(tot);
    const key = `${seccion}||${grupo}`;
    return (
      <tr
        className="cursor-pointer border-b border-border/30"
        style={{ background: "#151f33" }}
        onClick={() => togGrupo(key)}
      >
        <td className="px-4 py-1.5 pl-8 text-[12px] font-semibold text-foreground">
          <span className="mr-2 text-[10px] text-muted-foreground">{openGrupos.has(key) ? "▾" : "▸"}</span>
          {grupo}
        </td>
        <td
          className={`whitespace-nowrap px-4 py-1.5 text-right font-semibold tabular-nums text-[12px] ${f.neg ? "text-destructive" : f.zero ? "text-muted-foreground/30" : "text-foreground"}`}
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
        style={{ background: highlight ? (valor >= 0 ? "#0d2040" : "#2d1a1a") : valor >= 0 ? "#1a2d1a" : "#2d1a1a" }}
      >
        <td
          className={`px-4 py-2 text-[12px] font-bold text-foreground ${highlight ? "border-l-2 border-l-primary" : ""}`}
        >
          {label}
        </td>
        <td
          className={`whitespace-nowrap px-4 py-2 text-right font-bold tabular-nums text-[12px] ${f.neg ? "text-destructive" : f.zero ? "text-muted-foreground" : highlight ? "text-primary" : "text-foreground"}`}
        >
          {f.text}
        </td>
      </tr>
    );
  };

  const secciones = ["ACTIVO", "PASIVO", "PATRIMONIO"];

  return (
    <AppLayout title="Estado de Situación Financiera">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {meses.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin datos cargados aún</span>
          ) : (
            meses.map((m) => (
              <button
                key={m}
                onClick={() => setMesSelec(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${mesActivo === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {mesLabel(m)}
              </button>
            ))
          )}
        </div>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${cargando ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Upload className="h-3.5 w-3.5" />
          {cargando ? "Cargando..." : "Cargar auxiliar"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={cargando} />
        </label>
      </div>

      {!mesActivo && meses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <div className="text-4xl">📊</div>
          <p className="text-sm font-medium text-foreground">Carga un auxiliar de balance para comenzar</p>
          <p className="text-xs text-muted-foreground">Formatos soportados: .xlsx, .xls</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            <Upload className="h-3.5 w-3.5" />
            Cargar primer auxiliar
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={cargando} />
          </label>
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
                <th className="min-w-[320px] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Concepto
                </th>
                <th className="min-w-[160px] whitespace-nowrap px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {mesActivo ? mesLabel(mesActivo) : "—"}
                </th>
              </tr>
            </thead>
            <tbody>
              {secciones.map((seccion) => {
                const grupos = gruposPorSeccion.get(seccion) ?? [];
                return (
                  <Fragment key={seccion}>
                    <SeccionHeader label={seccion === "PASIVO" ? "PASIVO Y PATRIMONIO" : seccion} seccion={seccion} />
                    {seccion === "PASIVO" && openSecciones.has(seccion) && (
                      <tr style={{ background: "#1a2535" }}>
                        <td
                          colSpan={2}
                          className="px-4 py-1.5 pl-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          PASIVO
                        </td>
                      </tr>
                    )}
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
                                    <td className="px-4 py-1 pl-14 text-[11px] text-muted-foreground/80">
                                      {c.concepto}
                                    </td>
                                    <CV v={v} />
                                  </tr>
                                );
                              })}
                            {openGrupos.has(key) && (
                              <TotalRow label={`TOTAL ${grupo}`} valor={totalGrupo(grupo, seccion)} />
                            )}
                          </Fragment>
                        );
                      })}
                    {seccion === "ACTIVO" && <TotalRow label="TOTAL ACTIVO" valor={totalActivo} highlight />}
                    {seccion === "PASIVO" && openSecciones.has(seccion) && (
                      <TotalRow label="TOTAL PASIVO" valor={totalPasivo} />
                    )}
                    {seccion === "PATRIMONIO" && openSecciones.has(seccion) && (
                      <>
                        <TotalRow label="TOTAL PATRIMONIO" valor={totalPatrimonio} />
                        <TotalRow label="TOTAL PASIVO Y PATRIMONIO" valor={totalPasivoPatrimonio} highlight />
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
