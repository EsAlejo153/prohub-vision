import { ChevronDown } from "lucide-react";

const filters = [
  { label: "Año", options: ["2024", "2025", "2026"] },
  { label: "Mes", options: ["Enero", "Febrero", "Marzo", "Abril"] },
  { label: "Centro de Costos", options: ["Todos", "Operaciones", "Administración"] },
  { label: "Empresa", options: ["Prohub S.A.S.", "iQlick Consulting"] },
];

export default function TopBar({ title }: { title: string }) {
  return (
    <header
      className="fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur"
      style={{ left: 180 }}
    >
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <FilterDropdown key={f.label} label={f.label} options={f.options} />
        ))}
      </div>
    </header>
  );
}

function FilterDropdown({ label, options }: { label: string; options: string[] }) {
  return (
    <div className="relative">
      <select
        defaultValue=""
        className="appearance-none rounded-md border border-border bg-card px-3 py-1.5 pr-8 text-xs font-medium text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        <option value="" disabled hidden>{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
