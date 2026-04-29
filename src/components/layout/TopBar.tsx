import { ChevronDown } from "lucide-react";
import { useFiltros } from "@/context/FiltrosContext";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCentrosCosto } from "@/hooks/useCentrosCosto";

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const ANIOS = [2024, 2025, 2026, 2027];

export default function TopBar({ title }: { title: string }) {
  const f = useFiltros();
  const { data: empresas } = useEmpresas();
  const empresaSel = empresas?.find((e) => e.nombre === f.compania);
  const { data: centros } = useCentrosCosto(empresaSel?.id);

  return (
    <header
      className="fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur"
      style={{ left: 180 }}
    >
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <Dropdown
          label="Año"
          value={String(f.año)}
          onChange={(v) => f.setAño(v === "Todas" ? "Todas" : Number(v))}
          options={["Todas", ...ANIOS.map(String)]}
        />
        <Dropdown
          label="Mes"
          value={f.mes === "Todos" ? "Todos" : MESES[f.mes - 1]}
          onChange={(v) => {
            if (v === "Todos") return f.setMes("Todos");
            const idx = MESES.indexOf(v);
            f.setMes(idx >= 0 ? idx + 1 : "Todos");
          }}
          options={["Todos", ...MESES]}
        />
        <Dropdown
          label="Centro de Costos"
          value={f.ccKey}
          onChange={(v) => f.setCcKey(v)}
          options={["Todas", ...(centros?.map((c) => c.codigo) ?? [])]}
          renderOption={(v) => {
            if (v === "Todas") return "Todas";
            const cc = centros?.find((c) => c.codigo === v);
            return cc ? `${cc.codigo} · ${cc.nombre}` : v;
          }}
        />
        <Dropdown
          label="Empresa"
          value={f.compania}
          onChange={(v) => f.setCompania(v)}
          options={["Todas", ...(empresas?.map((e) => e.nombre) ?? [])]}
        />
      </div>
    </header>
  );
}

function Dropdown({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderOption?: (v: string) => string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-border bg-card px-3 py-1.5 pr-8 text-xs font-medium text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {label}: {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
