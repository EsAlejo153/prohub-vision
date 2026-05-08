import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, X, AlertCircle } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { parseWorkbook, formatBytes, rowToInsert, type ParsedRow } from "@/lib/parseAuxiliar";
import { supabase } from "@/lib/external-supabase";
import { toast } from "sonner";
import { ErrorViewer } from "@/components/cargue/ErrorViewer";

type Step = "upload" | "preview" | "processing" | "success";

const ACCEPTED = [".xls", ".xlsx"];

// Clave única igual al constraint de la BD
function rowKey(r: ReturnType<typeof rowToInsert>): string {
  return [r.compania, r.cuenta_key, r.fecha_key, r.cc_key, r.comprobante, r.debito, r.credito, r.concepto].join("||");
}

export default function Cargue() {
  const navigate = useNavigate();
  const empresas = useEmpresas();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [insertedCount, setInsertedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [dupCount, setDupCount] = useState(0);
  const [insertError, setInsertError] = useState<string | null>(null);
  const [showDuplicadosConfirm, setShowDuplicadosConfirm] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((r) => r.valid).length;
    const invalid = total - valid;
    const errorRate = total > 0 ? invalid / total : 0;
    return { total, valid, invalid, errorRate };
  }, [rows]);

  const empresaSeleccionada = empresas.data?.find((e) => e.id === empresaId);

  const onPickFile = (f: File | null) => {
    if (!f) return;
    const ok = ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      toast.error("Por favor sube un archivo .xls o .xlsx");
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onPickFile(e.dataTransfer.files?.[0] ?? null);
  }, []);

  const handleParse = async () => {
    if (!file) return;
    if (!empresaId) {
      toast.error("Selecciona una empresa");
      return;
    }
    setParsing(true);
    try {
      const { rows: parsed, sheetFound } = await parseWorkbook(file);
      if (!sheetFound) {
        toast.error("No se encontró la hoja 'BD' en el archivo.");
        setParsing(false);
        return;
      }
      if (parsed.length === 0) {
        toast.error("La hoja 'BD' está vacía.");
        setParsing(false);
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Error al leer el archivo Excel.");
    } finally {
      setParsing(false);
    }
  };

  /**
   * ignoreDuplicates = true  → omite duplicados contra la BD (comportamiento normal)
   * ignoreDuplicates = false → sobreescribe duplicados contra la BD (forzar importación)
   * En ambos casos deduplicamos primero las filas del propio archivo para evitar el error
   * "ON CONFLICT DO UPDATE command cannot affect row a second time"
   */
  const handleConfirmImport = async (ignoreDuplicates: boolean = true) => {
    if (!file) return;
    setStep("processing");
    setInsertError(null);
    setShowDuplicadosConfirm(false);

    try {
      const archivoPayload = {
        nombre_archivo: file.name,
        compania: empresaSeleccionada?.nombre ?? null,
        total_filas: stats.total,
        filas_insertadas: stats.valid,
        filas_rechazadas: stats.invalid,
        estado: "OK",
      };
      const { data: archivoRow, error: archivoErr } = await supabase
        .from("archivos_cargados")
        .insert(archivoPayload)
        .select("id")
        .maybeSingle();

      const archivoId: string | undefined = archivoErr || !archivoRow ? undefined : (archivoRow as { id: string }).id;

      // Mapear todas las filas válidas
      const allRows = rows.filter((r) => r.valid).map((r) => rowToInsert(r, archivoId));

      // ── Deduplicar filas del propio archivo ──────────────────────────────────
      // Cuando hay duplicados internos, nos quedamos con la ÚLTIMA ocurrencia
      // (igual que si el archivo tuviera una corrección al final)
      const dedupMap = new Map<string, (typeof allRows)[number]>();
      for (const r of allRows) {
        dedupMap.set(rowKey(r), r);
      }
      const internalDups = allRows.length - dedupMap.size;
      const dedupedRows = Array.from(dedupMap.values());
      // ────────────────────────────────────────────────────────────────────────

      const failed: { batchStart: number; error: string; code?: string }[] = [];
      const BATCH = 500;
      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < dedupedRows.length; i += BATCH) {
        const chunk = dedupedRows.slice(i, i + BATCH);
        try {
          const { data, error } = await supabase
            .from("movimientos")
            .upsert(chunk, {
              onConflict: "compania,cuenta_key,fecha_key,cc_key,comprobante,debito,credito,concepto",
              ignoreDuplicates,
            })
            .select("id");

          if (error) {
            failed.push({ batchStart: i, error: error.message, code: error.code });
          } else {
            const insertedInChunk = Array.isArray(data) ? data.length : 0;
            inserted += insertedInChunk;
            skipped += chunk.length - insertedInChunk;
          }
        } catch (batchErr: any) {
          failed.push({ batchStart: i, error: batchErr?.message ?? String(batchErr) });
        }
      }

      setInsertedCount(inserted);
      setSkippedCount(skipped);
      setDupCount(internalDups);

      if (failed.length > 0 && inserted === 0) {
        setInsertError(
          `No se pudo importar ningún registro.\nMensaje: ${failed[0].error}\n(${failed.length} lote(s) fallaron)`,
        );
        setStep("preview");
        return;
      }

      if (failed.length > 0) {
        toast.warning(`${inserted} importados, ${failed.length} lote(s) fallaron: ${failed[0].error}`);
      }

      setStep("success");
    } catch (err: any) {
      setInsertError(`Error inesperado: ${err?.message ?? String(err)}`);
      setStep("preview");
    }
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setInsertedCount(0);
    setSkippedCount(0);
    setDupCount(0);
    setInsertError(null);
    setShowDuplicadosConfirm(false);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout title="Cargue de Datos">
      <Stepper step={step} />

      {step === "upload" && (
        <div className="mt-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Arrastra tu archivo Excel aquí o haz clic para seleccionar
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">Formatos aceptados: .xls, .xlsx</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-success" />
                <div>
                  <div className="text-sm font-medium text-foreground">{file.name}</div>
                  <div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Selecciona una empresa…</option>
              {(empresas.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleParse} disabled={!file || !empresaId || parsing} className="gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Procesar archivo
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total filas" value={stats.total.toLocaleString("es-CO")} />
            <StatCard label="Válidas" value={stats.valid.toLocaleString("es-CO")} tone="good" />
            <StatCard
              label="Con errores"
              value={stats.invalid.toLocaleString("es-CO")}
              tone={stats.invalid > 0 ? "bad" : "good"}
            />
          </div>

          {stats.errorRate > 0.2 && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Más del 20% de las filas tienen errores. Revisa el archivo antes de importar.
            </div>
          )}

          {insertError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <pre className="whitespace-pre-wrap font-mono text-[11px]">{insertError}</pre>
            </div>
          )}

          <ErrorViewer rows={rows} onRowsChange={setRows} />

          {/* Confirmación sobreescritura */}
          {showDuplicadosConfirm && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-500">¿Estás seguro de sobreescribir los duplicados?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los registros que ya existen en la base de datos serán actualizados con los valores del archivo. Las
                    filas duplicadas dentro del mismo archivo se consolidan automáticamente (se conserva la última).
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowDuplicadosConfirm(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  onClick={() => handleConfirmImport(false)}
                >
                  <AlertCircle className="h-4 w-4" />
                  Sí, sobreescribir duplicados
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancelar
            </Button>
            {!showDuplicadosConfirm && (
              <Button
                variant="outline"
                onClick={() => setShowDuplicadosConfirm(true)}
                disabled={stats.valid === 0}
                className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
              >
                <AlertCircle className="h-4 w-4" />
                Importar con duplicados
              </Button>
            )}
            <Button
              onClick={() => handleConfirmImport(true)}
              disabled={stats.errorRate > 0.2 || stats.valid === 0}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Confirmar e importar ({stats.valid.toLocaleString("es-CO")})
            </Button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">Importando registros…</h2>
          <p className="mt-1 text-xs text-muted-foreground">No cierres esta ventana.</p>
        </div>
      )}

      {step === "success" && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-success/30 bg-success/5 p-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-success" />
          <h2 className="mt-4 text-2xl font-bold text-foreground">¡Importación exitosa!</h2>
          <div className="mt-4 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-success/30 bg-success/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-success">Importados</div>
              <div className="mt-1 text-xl font-bold text-success tabular-nums">
                {insertedCount.toLocaleString("es-CO")}
              </div>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Omitidos BD</div>
              <div className="mt-1 text-xl font-bold text-amber-500 tabular-nums">
                {skippedCount.toLocaleString("es-CO")}
              </div>
            </div>
            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Dups archivo</div>
              <div className="mt-1 text-xl font-bold text-blue-400 tabular-nums">
                {dupCount.toLocaleString("es-CO")}
              </div>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Con errores</div>
              <div className="mt-1 text-xl font-bold text-destructive tabular-nums">
                {stats.invalid.toLocaleString("es-CO")}
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => navigate("/dashboard")}>Ver en Dashboard</Button>
            <Button variant="outline" onClick={reset}>
              Cargar otro archivo
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "border-success/30 text-success"
      : tone === "bad"
        ? "border-destructive/30 text-destructive"
        : "border-border text-foreground";
  return (
    <div className={`rounded-md border bg-card p-4 ${cls}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: "upload", label: "1. Subir archivo" },
    { id: "preview", label: "2. Validar" },
    { id: "processing", label: "3. Procesar" },
    { id: "success", label: "4. Listo" },
  ];
  const idx = items.findIndex((i) => i.id === step);
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={it.id} className="flex items-center gap-2">
            <div
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-success/20 text-success"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {it.label}
            </div>
            {i < items.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
