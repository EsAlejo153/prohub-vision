import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/external-supabase";

// Minimal typed wrapper: supabase.auth.oauth is beta and may not be in the
// installed .d.ts. Cast once here so the rest of this file stays typed.
interface OAuthNs {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
}
const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

function safeRelative(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta authorization_id en la URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message ?? String(error));
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message ?? String(error));
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("El servidor de autorización no devolvió una URL de redirección.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-foreground">No se pudo cargar la solicitud</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "una aplicación externa";
  const redirectUri = details.client?.redirect_uri ?? details.client?.redirect_uris?.[0];
  const scopes: string[] = Array.isArray(details.requested_scopes)
    ? details.requested_scopes
    : typeof details.scope === "string"
    ? details.scope.split(/\s+/).filter(Boolean)
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="text-2xl font-extrabold tracking-tight text-primary">iQlick</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            Autorizar acceso
          </div>
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Conectar {clientName} a tu cuenta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esto permitirá que <span className="font-medium text-foreground">{clientName}</span> use
          las herramientas de iQlick actuando como tú. La aplicación solo podrá acceder a los datos
          que tus permisos ya te permiten ver.
        </p>

        {redirectUri && (
          <p className="mt-3 break-all rounded-md border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
            Redirección: {redirectUri}
          </p>
        )}

        {scopes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Permisos solicitados</p>
            <ul className="list-disc pl-5 text-sm text-foreground">
              {scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Procesando..." : "Autorizar"}
          </button>
        </div>
      </div>
    </main>
  );
}

export { safeRelative };