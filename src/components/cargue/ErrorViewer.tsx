import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Copy, CheckCircle2, X } from "lucide-react";
import type { ParsedRow, ErrorField } from "@/lib/parseAuxiliar";
import { validateAndCompute, type RawRow } from "@/lib/parseAuxiliar";
import { toast } from "sonner";

type Tab = "valid" | "errors";

const COLUMNS: { key: ErrorField | "__rownum__" | "__error__"; label: string; width?: string }[] = [
  { key: "__rownum__", label: "# Fila", width: "70px" },
  { key: "Compañia", label: "Compañia" },
  { key: "Cuenta", label: "Cuenta" },
  { key: "Nombre", label: "Nombre" },
  { key: "Fecha", label: "Fecha" },
  { key: "Débito", label: "Débito" },
  { key: "Crédito", label: "Crédito" },
  { key: "Centro Costos", label: "Centro Costos" },
  { key: "Comprobante", label: "Comprobante" },
  { key: "Concepto", label: "Concepto" },
  { key: "__error__", label: "Error" },
];

interface Props {
  rows: ParsedRow[];
  onRowsChange: (rows: ParsedRow[]) => void;
}

export function ErrorViewer({ rows, onRowsChange }: Props) {
  const [tab, setTab] = useState<Tab>("errors");
  const [search, setSearch] = useState("");
  const [errorFilter, setErrorFilter] = useState<string>("");
  const [editing, setEditing] = useState<{ rowIdx: number; field: ErrorField } | null>(null);
  const [editValue, setEditValue] = useState("");

  const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => !r.valid), [rows]);

  const errorTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    errorRows.forEach((r) => r.errors.forEach((e) => (counts[e] = (counts[e] ?? 0) + 1)));
    return counts;
  }, [errorRows]);

  const filteredErrorRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return errorRows.filter((r) => {
      if (errorFilter && !r.errors.includes(errorFilter)) return false;
      if (!q) return true;
      const blob = JSON.stringify(r.raw).toLowerCase();
      return blob.includes(q) || String(r.excelRow ?? "").includes(q);
    });
  }, [errorRows, search, errorFilter]);

  const exportErrors = () => {
    const data = errorRows.map((r) => ({
      "# Fila": r.excelRow,
      Compañia: r.raw.Compañia ?? "",
      Cuenta: r.raw.Cuenta ?? "",
      Nombre: r.raw.Nombre ?? "",
      Fecha: r.raw.Fecha ?? "",
      Débito: r.raw.Débito ?? "",
      Crédito: r.raw.Crédito ?? "",
      "Centro Costos": r.raw["Centro Costos"] ?? "",
      Comprobante: r.raw.Comprobante ?? "",
      Concepto: r.raw.Concepto ?? "",
      Error: r.errors.join(" | "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errores");
    XLSX.writeFile(wb, "errores_cargue.xlsx");
    toast.success("Errores exportados");
  };

  const copyErrors = async () => {
    const headers = ["# Fila", "Compañia", "Cuenta", "Nombre", "Fecha", "Débito", "Crédito", "Centro Costos", "Comprobante", "Concepto", "Error"];
    const lines = [headers.join("\t")];
    errorRows.forEach((r) => {
      lines.push(
        [
          r.excelRow,
          r.raw.Compañia ?? "",
          r.raw.Cuenta ?? "",
          r.raw.Nombre ?? "",
          r.raw.Fecha ?? "",
          r.raw.Débito ?? "",
          r.raw.Crédito ?? "",
          r.raw["Centro Costos"] ?? "",
          r.raw.Comprobante ?? "",
          r.raw.Concepto ?? "",
          r.errors.join(" | "),
        ].join("\t"),
      );
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copiado al portapapeles");
  };

  const startEdit = (rowIdx: number, field: ErrorField) => {
    const r = rows[rowIdx];
    if (!r) return;
    const current = (r.raw as any)[field];
    setEditValue(current == null ? "" : String(current));
    setEditing({ rowIdx, field });
  };

  const applyEdit = () => {
    if (!editing) return;
    const { rowIdx, field } = editing;
    const original = rows[rowIdx];
    const newRaw: RawRow = { ...original.raw, [field]: editValue } as RawRow;
    const reparsed = validateAndCompute(newRaw);
    reparsed.excelRow = original.excelRow;
    const next = [...rows];
    next[rowIdx] = reparsed;
    onRowsChange(next);
    setEditing(null);
    if (reparsed.valid) toast.success(`Fila ${original.excelRow} corregida`);
  };

  const cellValue = (r: ParsedRow, key: string): string => {
    if (key === "__rownum__") return String(r.excelRow ?? "");
    if (key === "__error__") return r.errors.join(" • ");
    const v = (r.raw as any)[key];
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v == null ? "" : String(v);
  };

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("valid")}
          className={`relative px-4 py-2 text-xs font-semibold transition-colors ${
            tab === "valid"
              ? "text-success border-b-2 border-success -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Filas válidas ({validRows.length.toLocaleString("es-CO")})
        </button>
        <button
          onClick={() => setTab("errors")}
          className={`relative px-4 py-2 text-xs font-semibold transition-colors ${
            tab === "errors"
              ? "text-destructive border-b-2 border-destructive -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Filas con errores
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
            {errorRows.length.toLocaleString("es-CO")}
          </span>
        </button>
      </div>

      {tab === "valid" && (
        <div className="overflow-auto rounded-md border border-border bg-card">
          <table className="w-full text-[11px]">
            <thead className="bg-background/40">
              <tr>
                {["# Fila", "Compañia", "Cuenta", "Fecha", "Débito", "Crédito", "CC"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {validRows.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-2 py-1 text-muted-foreground tabular-nums">{r.excelRow}</td>
                  <td className="px-2 py-1">{r.compania ?? "--"}</td>
                  <td className="px-2 py-1 font-mono tabular-nums">{r.cuenta_key}</td>
                  <td className="px-2 py-1">{r.fecha ? r.fecha.toISOString().slice(0, 10) : "--"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{(r.debito ?? 0).toLocaleString("es-CO")}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{(r.credito ?? 0).toLocaleString("es-CO")}</td>
                  <td className="px-2 py-1">{r.cc_key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {validRows.length > 50 && (
            <div className="border-t border-border bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
              Mostrando 50 de {validRows.length.toLocaleString("es-CO")} filas válidas
            </div>
          )}
        </div>
      )}

      {tab === "errors" && (
        <>
          {/* Error type badges */}
          {Object.keys(errorTypeCounts).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(errorTypeCounts).map(([err, count]) => (
                <button
                  key={err}
                  onClick={() => setErrorFilter(errorFilter === err ? "" : err)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                    errorFilter === err
                      ? "border-destructive bg-destructive/20 text-destructive"
                      : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  }`}
                >
                  {err}: {count}
                </button>
              ))}
              {errorFilter && (
                <button
                  onClick={() => setErrorFilter("")}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Limpiar filtro
                </button>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en errores…"
              className="h-8 max-w-xs text-xs"
            />
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={copyErrors} className="h-8 gap-1 text-xs">
              <Copy className="h-3 w-3" /> Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={exportErrors} className="h-8 gap-1 text-xs">
              <Download className="h-3 w-3" /> Exportar errores a Excel
            </Button>
          </div>

          {/* Error table */}
          <TooltipProvider delayDuration={150}>
            <div className="overflow-auto rounded-md border border-border bg-card">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-background/90 backdrop-blur">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        style={c.width ? { width: c.width } : undefined}
                        className="whitespace-nowrap px-2 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredErrorRows.slice(0, 200).map((r) => {
                    const rowIdx = rows.indexOf(r);
                    const rowEmpty = r.fieldErrors.__row__;
                    return (
                      <tr
                        key={rowIdx}
                        className="border-t border-border/40"
                        style={{ backgroundColor: rowEmpty ? "#2d1a1a" : "#2d1f0a" }}
                      >
                        {COLUMNS.map((c) => {
                          const isRowNum = c.key === "__rownum__";
                          const isErrorCol = c.key === "__error__";
                          const fieldErr = !isRowNum && !isErrorCol
                            ? r.fieldErrors[c.key as ErrorField]
                            : undefined;
                          const hasErr = Boolean(fieldErr) || (rowEmpty && !isRowNum && !isErrorCol);
                          const value = cellValue(r, c.key);
                          const isEditing =
                            editing &&
                            editing.rowIdx === rowIdx &&
                            editing.field === c.key;

                          if (isErrorCol) {
                            return (
                              <td key={c.key} className="px-2 py-1 text-destructive font-medium">
                                {value}
                              </td>
                            );
                          }
                          if (isRowNum) {
                            return (
                              <td key={c.key} className="px-2 py-1 font-mono tabular-nums text-muted-foreground">
                                {value}
                              </td>
                            );
                          }

                          const cellInner = isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") applyEdit();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                className="w-full rounded border border-primary bg-background px-1 py-0.5 text-[11px] text-foreground"
                              />
                              <button
                                onClick={applyEdit}
                                className="rounded bg-success/20 p-0.5 text-success hover:bg-success/30"
                                title="Aplicar corrección"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="rounded bg-muted p-0.5 text-muted-foreground hover:bg-muted/80"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className={hasErr ? "cursor-pointer" : ""}>{value || (hasErr ? "—" : "")}</span>
                          );

                          const tdStyle = hasErr
                            ? { backgroundColor: "#2d1a1a", border: "1px solid hsl(var(--destructive))" }
                            : undefined;

                          if (hasErr && !isEditing) {
                            return (
                              <td
                                key={c.key}
                                style={tdStyle}
                                className="px-2 py-1"
                                onClick={() => !rowEmpty && startEdit(rowIdx, c.key as ErrorField)}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-destructive">{value || "—"}</div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                                    {fieldErr ?? rowEmpty}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          }

                          return (
                            <td key={c.key} style={tdStyle} className="px-2 py-1">
                              {cellInner}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredErrorRows.length === 0 && (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  No hay errores que coincidan con el filtro.
                </div>
              )}
              {filteredErrorRows.length > 200 && (
                <div className="border-t border-border bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
                  Mostrando 200 de {filteredErrorRows.length.toLocaleString("es-CO")} filas con errores
                </div>
              )}
            </div>
          </TooltipProvider>

          <p className="text-[11px] text-muted-foreground">
            💡 Haz clic en una celda roja para editarla. Presiona <kbd className="rounded border border-border px-1">Enter</kbd> para aplicar.
          </p>
        </>
      )}
    </div>
  );
}