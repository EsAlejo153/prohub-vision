import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check } from "lucide-react";
import { clasificarCuenta, type CuentaSinClasificar } from "@/hooks/useClasificacion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function ClasificarCuentaCell({
  cuenta,
  grupos,
}: {
  cuenta: CuentaSinClasificar;
  grupos: string[];
}) {
  const qc = useQueryClient();
  const defaultSigno = cuenta.signo_actual ?? (cuenta.clase_cod === "4" ? 1 : -1);
  const [grupo, setGrupo] = useState<string>(cuenta.grupo_titulo_actual ?? "");
  const [signo, setSigno] = useState<number>(defaultSigno);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const onSave = async () => {
    if (!grupo) {
      toast.error("Selecciona un grupo del ERI");
      return;
    }
    setSaving(true);
    try {
      await clasificarCuenta({
        cuenta_key: cuenta.cuenta_key,
        grupo_titulo: grupo,
        signo,
        ignorar: false,
      });
      toast.success(`Cuenta ${cuenta.cuenta_key} clasificada en ${grupo}`);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["cuentas_sin_clasificar"] }),
        qc.invalidateQueries({ queryKey: ["alerta_cuentas"] }),
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al clasificar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={grupo} onValueChange={setGrupo}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Selecciona grupo..." />
        </SelectTrigger>
        <SelectContent>
          {grupos.map((g) => (
            <SelectItem key={g} value={g} className="text-xs">
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={() => setSigno(signo === 1 ? -1 : 1)}
        className={`h-8 rounded-md border px-2 text-[11px] font-semibold ${
          signo === 1
            ? "border-success/40 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        }`}
        title="Cambiar signo"
      >
        {signo === 1 ? "+1 suma" : "−1 resta"}
      </button>
      <Button size="sm" className="h-8 px-2 text-xs" onClick={onSave} disabled={saving}>
        {savedFlash ? <Check className="h-3.5 w-3.5" /> : "Guardar"}
      </Button>
    </div>
  );
}