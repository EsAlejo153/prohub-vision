import { NavLink, Link } from "react-router-dom";
import { BarChart3, TrendingUp, Scale, Upload, Settings, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAlertaCuentas } from "@/hooks/useClasificacion";
import { usePerfil } from "@/hooks/useAdmin";

const main = [
  { to: "/dashboard", label: "Dashboard Financiero", icon: BarChart3 },
  { to: "/eri", label: "Estado de Resultados", icon: TrendingUp },
  { to: "/balance", label: "Balance General", icon: Scale },
];
const analisis = [
  { to: "/cargue", label: "Cargue de Datos", icon: Upload },
  { to: "/configuracion", label: "Configuración", icon: Settings, showBadge: true },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const { data: alerta } = useAlertaCuentas();
  const pendientes = alerta?.pendientes_eri ?? 0;
  const { data: perfil } = usePerfil(user?.id);
  const isAdmin = perfil?.rol === "admin";

  return (
    <aside
      className="fixed left-0 top-0 z-30 flex h-screen w-[180px] flex-col border-r border-border"
      style={{ background: "hsl(var(--sidebar))" }}
    >
      <div className="px-5 py-6">
        <div className="text-2xl font-extrabold tracking-tight text-primary">iQlick</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Control Financiero
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        <SectionLabel>Principal</SectionLabel>
        <div className="mt-1 space-y-0.5">
          {main.map((it) => <NavItem key={it.to} {...it} />)}
        </div>

        <div className="mt-6">
          <SectionLabel>Análisis</SectionLabel>
          <div className="mt-1 space-y-0.5">
            {analisis.map((it) => (
              <NavItem
                key={it.to}
                to={it.to}
                label={it.label}
                icon={it.icon}
                badge={it.showBadge && pendientes > 0 ? pendientes : undefined}
              />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <SectionLabel>Administración</SectionLabel>
            <div className="mt-1 space-y-0.5">
              <NavItem to="/admin" label="Admin" icon={Shield} />
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-md p-1 hover:bg-secondary"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium text-foreground">{user?.email}</div>
            <div className="text-[10px] text-muted-foreground">Ver perfil</div>
          </div>
        </Link>
        <button
          onClick={signOut}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${
          isActive
            ? "bg-primary/15 text-primary border-l-2 border-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
