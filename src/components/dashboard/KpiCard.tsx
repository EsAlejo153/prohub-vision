interface Props {
  label: string;
  value: string;
  subtitle: string;
  positive?: boolean;
}

export default function KpiCard({ label, value, subtitle, positive = true }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border bg-card p-4"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: positive ? "hsl(var(--primary))" : "hsl(var(--destructive))",
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{subtitle}</div>
    </div>
  );
}
