import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface ProfileRow {
  nombre?: string | null;
  rol?: string | null;
  empresa?: string | null;
  empresa_nombre?: string | null;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Best-effort fetch from profiles table; ignore errors gracefully.
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile((data ?? null) as ProfileRow | null);
      setLoading(false);
    })();
  }, [user]);

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <AppLayout title="Mi Perfil">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {initial}
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">
                {profile?.nombre ?? user?.email ?? "Usuario"}
              </div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email" value={user?.email ?? "--"} />
            <Field label="Rol" value={loading ? "..." : profile?.rol ?? "viewer"} />
            <Field
              label="Empresa asignada"
              value={loading ? "..." : profile?.empresa_nombre ?? profile?.empresa ?? "Todas"}
            />
            <Field
              label="ID de usuario"
              value={user?.id ? `${user.id.slice(0, 8)}…` : "--"}
            />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Button variant="destructive" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
