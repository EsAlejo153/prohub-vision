import { useEffect, useState } from "react";
import { supabase } from "@/lib/external-supabase";

interface CuentaFaltante {
  cuenta_key: string;
  nombre_cuenta: string;
  clase: string;
  grupo: string;
  total: number;
}

export default function AlertaCuentasSinPlan() {
  const [cuentas, setCuentas] = useState<CuentaFaltante[]>([]);
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { data, error } = await (supabase.rpc as any)("cuentas_sin_plan_pyg");
        if (error || !data || cancelled) return;
        const faltantes = (data as any[])
          .filter((r) => Number(r.total) !== 0)
          .map((r) => ({
            cuenta_key: r.cuenta_key,
            nombre_cuenta: r.nombre_cuenta ?? "",
            clase: r.clase ?? "",
            grupo: r.grupo ?? "",
            total: Number(r.total ?? 0),
          }));
        if (faltantes.length > 0) {
          setCuentas(faltantes);
          setVisible(true);
        }
      } catch {
        /* ignore */
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || cuentas.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border bg-card shadow-xl"
      style={{ borderColor: "#f59e0b" }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
          ⚠️ {cuentas.length} cuenta{cuentas.length > 1 ? "s" : ""} sin clasificar en P&amp;G
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbierto((v) => !v)}
            className="rounded border px-2 py-0.5 text-[10px]"
            style={{ color: "#f59e0b", borderColor: "#f59e0b55" }}
          >
            {abierto ? "Ocultar" : "Ver"}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="px-3 pb-2 text-[10px] text-muted-foreground">
        Estas cuentas tienen movimientos pero no están en plan_pyg. Los valores no aparecerán en el ERI ni en el Dashboard.
      </div>
      {abierto && (
        <div className="max-h-72 overflow-auto border-t border-border">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Cuenta</th>
                <th className="px-2 py-1 text-left font-medium">Nombre</th>
                <th className="px-2 py-1 text-left font-medium">Clase</th>
                <th className="px-2 py-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="px-2 py-1 font-mono">{c.cuenta_key}</td>
                  <td className="px-2 py-1">{c.nombre_cuenta}</td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {c.clase}
                    {c.grupo ? `/${c.grupo}` : ""}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {Number(c.total).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[10px] text-muted-foreground">
            Agrégalas a plan_pyg para que aparezcan en los reportes.
          </div>
        </div>
      )}
    </div>
  );
}