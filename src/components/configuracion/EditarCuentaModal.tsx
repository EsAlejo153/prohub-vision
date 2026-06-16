import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGruposPyg,
  useTiposGasto,
  useDetallesGasto,
  useJerarquiaCuenta,
  editarCuenta,
} from "@/hooks/useClasificacion";
import type { CuentaSinClasificar } from "@/hooks/useClasificacion";

interface Props {
  cuenta: CuentaSinClasificar | null;
  open: boolean;
  onClose: () => void;
}

export default function EditarCuentaModal({ cuenta, open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: grupos = [] } = useGruposPyg();
  const { data: tiposGasto = [] } = useTiposGasto();
  const { data: detallesGasto = [] } = useDetallesGasto();
  const { data: jerarquiaActual } = useJerarquiaCuenta(
    cuenta?.clase_cod === "5" ? cuenta.cuenta_key : null
  );

  const [grupoTitulo, setGrupoTitulo] = useState("");
  const [tipoGasto, setTipoGasto] = useState("");
  const [detalleGasto, setDetalleGasto] = useState("");
  const [nombreCuenta, setNombreCuenta] = useState("");
  const [busy, setBusy] = useState(false);

  const esClase5 = cuenta?.clase_cod === "5";

  const detallesFiltrados = detallesGasto.filter(
    (d) => d.tipo_gasto === tipoGasto
  );

  useEffect(() => {
    if (!open || !cuenta) return;
    setGrupoTitulo(cuenta.grupo_titulo_actual ?? "");
    if (esClase5 && jerarquiaActual) {
      setTipoGasto(jerarquiaActual.tipo_gasto ?? "");
      setDetalleGasto(jerarquiaActual.detalle_gasto ?? "");
      setNombreCuenta(jerarquiaActual.nombre_cuenta ?? "");
    } else {
      setTipoGasto("");
      setDetalleGasto("");
      setNombreCuenta(cuenta.nombre_cuenta ?? "");
    }
  }, [open, cuenta, jerarquiaActual, esClase5]);

  const handleTipoGastoChange = (val: string) => {
    setTipoGasto(val);
    setDetalleGasto("");
  };

  const handleGuardar = async () => {
    if (!cuenta) return;
    if (!grupoTitulo) {
      toast.error("Debes seleccionar un grupo ERI");
      return;
    }
    if (esClase5 && (!tipoGasto || !detalleGasto)) {
      toast.error("Debes seleccionar tipo y detalle de gasto para cuentas clase 5");
      return;
    }
    setBusy(true);
    try {
      await editarCuenta({
        cuenta_key: cuenta.cuenta_key,
        grupo_titulo: grupoTitulo,
        tipo_gasto: esClase5 ? tipoGasto : null,
        detalle_gasto: esClase5 ? detalleGasto : null,
        nombre_cuenta_jerarquia: esClase5 ? nombreCuenta || cuenta.nombre_cuenta : null,
      });
      toast.success(`Cuenta ${cuenta.cuenta_key} actualizada correctamente`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["cuentas_sin_clasificar"] }),
        qc.invalidateQueries({ queryKey: ["alerta_cuentas"] }),
        qc.invalidateQueries({ queryKey: ["jerarquia_cuenta", cuenta.cuenta_key] }),
        qc.invalidateQueries({ queryKey: ["plan_pyg"] }),
        qc.invalidateQueries({ queryKey: ["gastos-por-cc"] }),
        qc.invalidateQueries({ queryKey: ["eri-all-months"] }),
        qc.invalidateQueries({ queryKey: ["eri-all-cc"] }),
      ]);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  if (!cuenta) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar clasificación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {cuenta.cuenta_key}
            </span>
            <span>·</span>
            <span>{cuenta.nombre_cuenta}</span>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Clase {cuenta.clase_cod} · {cuenta.tipo_cuenta}
          </div>

          <div className="space-y-2">
            <Label>Grupo en ERI</Label>
            <Select value={grupoTitulo} onValueChange={setGrupoTitulo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona grupo..." />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {esClase5 && (
            <div className="space-y-3 rounded-md border border-border/40 bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Jerarquía en árbol de gastos
              </div>

              <div className="space-y-2">
                <Label>Grupo primario (tipo de gasto)</Label>
                <Select value={tipoGasto} onValueChange={handleTipoGastoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposGasto.map((t) => (
                      <SelectItem key={t.tipo_gasto} value={t.tipo_gasto}>
                        {t.tipo_gasto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Grupo secundario (detalle de gasto)</Label>
                <Select value={detalleGasto} onValueChange={setDetalleGasto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona detalle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detallesFiltrados.map((d) => (
                      <SelectItem key={d.detalle_gasto} value={d.detalle_gasto}>
                        {d.detalle_gasto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Nombre en el árbol de gastos</Label>
                <Input
                  value={nombreCuenta}
                  onChange={(e) => setNombreCuenta(e.target.value)}
                  placeholder={cuenta.nombre_cuenta ?? "Nombre..."}
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Así aparecerá agrupado dentro del detalle de gastos en el ERI
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={busy}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
