export function formatCOP(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const millones = n / 1_000_000;
    return `$${millones.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  }
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  return `${n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function toMillones(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return n / 1_000_000;
}