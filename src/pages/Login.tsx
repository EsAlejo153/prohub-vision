import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/external-supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const rawNext = searchParams.get("next");
  const nextPath =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  useEffect(() => {
    if (session) {
      if (nextPath) {
        window.location.replace(nextPath);
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [session, navigate, nextPath]);

  const friendlyAuthError = (err: unknown): string => {
    const e = err as { code?: string; message?: string };
    const code = e?.code ?? "";
    const msg = (e?.message ?? "").toLowerCase();
    if (code === "invalid_credentials" || msg.includes("invalid login")) {
      return "Correo o contraseña incorrectos.";
    }
    if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
      return "Confirma tu correo antes de iniciar sesión.";
    }
    if (msg.includes("rate") || msg.includes("too many")) {
      return "Demasiados intentos. Inténtalo más tarde.";
    }
    return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bienvenido");
      if (nextPath) {
        window.location.replace(nextPath);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl font-extrabold tracking-tight text-primary">iQlick</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Control Financiero
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Accede al panel financiero de Prohub S.A.S.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Procesando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            El acceso es solo por invitación. Contacta al administrador.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} iQlick Consulting / Prohub S.A.S.
        </p>
      </div>
    </div>
  );
}
