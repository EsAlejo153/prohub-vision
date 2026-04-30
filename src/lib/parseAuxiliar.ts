import * as XLSX from "xlsx";

export interface RawRow {
  Compañia?: string;
  Cuenta?: string | number;
  Categoría?: string;
  Nombre?: string;
  "Cédula / NIT"?: string | number;
  "D.V."?: string | number;
  "Nombre Tercero"?: string;
  "Doc. Referencia"?: string;
  "Saldo Anterior"?: number;
  Débito?: number;
  Crédito?: number;
  "Saldo Final"?: number;
  "Centro Costos"?: string;
  Comprobante?: string;
  "Docto."?: string;
  Cheque?: string;
  Fecha?: string | number | Date;
  Concepto?: string;
  Usuario?: string;
}

export interface ParsedRow {
  raw: RawRow;
  // Computed
  fecha?: Date;
  fecha_key?: string;
  año_mes_num?: number;
  cuenta_key?: string;
  clase_cod?: string;
  tercero_key?: string;
  cc_key?: string;
  mov_neto?: number;
  nombre_cuenta?: string;
  compania?: string;
  saldo_anterior?: number;
  debito?: number;
  credito?: number;
  saldo_final?: number;
  comprobante?: string;
  docto?: string;
  concepto?: string;
  usuario?: string;
  // Validation
  errors: string[];
  fieldErrors: Partial<Record<ErrorField, string>>;
  rowEmpty?: boolean;
  excelRow?: number;
  valid: boolean;
}

export type ErrorField =
  | "Compañia"
  | "Cuenta"
  | "Nombre"
  | "Fecha"
  | "Débito"
  | "Crédito"
  | "Centro Costos"
  | "Comprobante"
  | "Concepto"
  | "__row__";

function parseExcelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    const s = v.trim();
    // dd/mm/yyyy or dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [, dd, mm, yy] = m;
      const y = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      return new Date(Date.UTC(y, Number(mm) - 1, Number(dd)));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function validateAndCompute(raw: RawRow): ParsedRow {
  const errors: string[] = [];
  const fieldErrors: Partial<Record<ErrorField, string>> = {};

  // Detect fully empty row
  const allValues = Object.values(raw);
  const rowEmpty = allValues.every(
    (v) => v == null || (typeof v === "string" && v.trim() === "") || v === 0,
  );
  // Treat as empty only when key fields are blank
  const keyBlank =
    !String(raw.Compañia ?? "").trim() &&
    !String(raw.Cuenta ?? "").trim() &&
    !raw.Fecha;
  if (keyBlank) {
    errors.push("Fila vacía");
    fieldErrors.__row__ = "Fila vacía";
    return {
      raw,
      errors,
      fieldErrors,
      rowEmpty: true,
      valid: false,
    };
  }

  const compania = String(raw.Compañia ?? "").trim();
  if (!compania) {
    errors.push("Compañía no puede estar vacía");
    fieldErrors["Compañia"] = "Compañía no puede estar vacía";
  }

  const cuentaRaw = String(raw.Cuenta ?? "").trim();
  const cuenta_key = cuentaRaw.replace(/\D/g, "");
  if (!cuenta_key || !/^\d{4,}$/.test(cuenta_key)) {
    errors.push("Cuenta inválida: debe tener mínimo 4 dígitos");
    fieldErrors["Cuenta"] = "Cuenta inválida: debe tener mínimo 4 dígitos";
  }

  const fecha = parseExcelDate(raw.Fecha);
  if (!fecha) {
    errors.push("Fecha inválida o vacía");
    fieldErrors["Fecha"] = "Fecha inválida o vacía";
  }

  const debito = toNumber(raw.Débito);
  const credito = toNumber(raw.Crédito);
  if (!Number.isFinite(debito) || debito < 0) {
    errors.push("El débito debe ser un número");
    fieldErrors["Débito"] = "El débito debe ser un número";
  }
  if (!Number.isFinite(credito) || credito < 0) {
    errors.push("El crédito debe ser un número");
    fieldErrors["Crédito"] = "El crédito debe ser un número";
  }

  let fecha_key: string | undefined;
  let año_mes_num: number | undefined;
  if (fecha) {
    const y = fecha.getUTCFullYear();
    const m = fecha.getUTCMonth() + 1;
    const d = fecha.getUTCDate();
    fecha_key = `${y}${pad(m)}${pad(d)}`;
    año_mes_num = y * 100 + m;
  }

  const clase_cod = cuenta_key ? cuenta_key[0] : undefined;
  const mov_neto = clase_cod === "4" ? credito - debito : debito - credito;
  const ccRaw = String(raw["Centro Costos"] ?? "").trim();
  const cc_key = ccRaw || "SIN CC";
  const tercero_key = String(raw["Cédula / NIT"] ?? "").trim() || undefined;

  return {
    raw,
    fecha: fecha ?? undefined,
    fecha_key,
    año_mes_num,
    cuenta_key,
    clase_cod,
    tercero_key,
    cc_key,
    mov_neto,
    nombre_cuenta: String(raw.Nombre ?? "").trim() || undefined,
    compania: compania || undefined,
    saldo_anterior: toNumber(raw["Saldo Anterior"]),
    debito,
    credito,
    saldo_final: toNumber(raw["Saldo Final"]),
    comprobante: String(raw.Comprobante ?? "").trim() || undefined,
    docto: String(raw["Docto."] ?? "").trim() || undefined,
    concepto: String(raw.Concepto ?? "").trim() || undefined,
    usuario: String(raw.Usuario ?? "").trim() || undefined,
    errors,
    fieldErrors,
    valid: errors.length === 0,
  };
}

export async function parseWorkbook(file: File): Promise<{ rows: ParsedRow[]; sheetFound: boolean }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === "BD");
  if (!sheetName) return { rows: [], sheetFound: false };
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: true });
  const rows = json.map((r, i) => {
    const parsed = validateAndCompute(r);
    parsed.excelRow = i + 2; // +1 for header, +1 for 1-index
    return parsed;
  });
  return { rows, sheetFound: true };
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function rowToInsert(r: ParsedRow, archivo_id?: string) {
  return {
    fecha_key: r.fecha_key,
    año_mes_num: r.año_mes_num,
    fecha: r.fecha ? r.fecha.toISOString().slice(0, 10) : null,
    cuenta_key: r.cuenta_key,
    tercero_key: r.tercero_key ?? null,
    cc_key: r.cc_key,
    clase_cod: r.clase_cod,
    nombre_cuenta: r.nombre_cuenta ?? null,
    compania: r.compania,
    saldo_anterior: r.saldo_anterior ?? 0,
    debito: r.debito ?? 0,
    credito: r.credito ?? 0,
    saldo_final: r.saldo_final ?? 0,
    mov_neto: r.mov_neto ?? 0,
    comprobante: r.comprobante ?? null,
    docto: r.docto ?? null,
    concepto: r.concepto ?? null,
    usuario: r.usuario ?? null,
    archivo_id: archivo_id ?? null,
  };
}
