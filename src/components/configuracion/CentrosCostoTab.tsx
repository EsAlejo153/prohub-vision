import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCentrosCostoDim,
  actualizarNombreCC,
  agregarCentroCosto,
} from "@/hooks/useClasificacion";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/dashboard/StateMessages";

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-CO");
  } catch {
    return d;
  }
}

export default function CentrosCostoTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useCentrosCostoDim();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");

  const startEdit = (codigo: string, current: string | null) => {
    setEditing(codigo);
    setDraft(current ?? "");
  };

  const saveEdit = async (codigo: string) => {
    try {
      await actualizarNombreCC(codigo, draft.trim() || null);
      toast.success("Nombre actualizado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["dim_centros_costo_full"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const onAdd = async () => {
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) {
      toast.error("Código y nombre son requeridos");
      return;
    }
    try {
      await agregarCentroCosto(nuevoCodigo.trim(), nuevoNombre.trim());
      toast.success("Centro de costo agregado");
      setNuevoCodigo("");
      setNuevoNombre("");
      qc.invalidateQueries({ queryKey: ["dim_centros_costo_full"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al agregar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton className="h-40" /></div>
        ) : isError ? (
          <div className="p-6"><ErrorState /></div>
        ) : !data || data.length === 0 ? (
          <div className="p-6"><EmptyState message="No hay centros de costo registrados" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Nombre para mostrar</TableHead>
                <TableHead className="text-xs">Primera vez visto</TableHead>
                <TableHead className="text-xs">Última vez visto</TableHead>
                <TableHead className="text-xs text-right">Movimientos</TableHead>
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((cc) => (
                <TableRow key={cc.codigo}>
                  <TableCell className="font-mono text-xs text-foreground">{cc.codigo}</TableCell>
                  <TableCell className="text-xs">
                    {editing === cc.codigo ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(cc.codigo);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          autoFocus
                          className="h-7 text-xs"
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEdit(cc.codigo)}>
                          <Check className="h-3.5 w-3.5 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(cc.codigo, cc.nombre_display)}
                        className="group inline-flex items-center gap-2 text-left"
                      >
                        <span className={cc.nombre_display ? "text-foreground" : "text-muted-foreground italic"}>
                          {cc.nombre_display ?? "SIN NOMBRE"}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(cc.primera_vez_vista)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(cc.ultima_vez_vista)}</TableCell>
                  <TableCell className="text-right text-xs">{(cc.movimientos_count ?? 0).toLocaleString("es-CO")}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold">Agregar centro de costo manualmente</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Código</label>
            <Input value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} className="h-9 w-40 text-xs" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Nombre</label>
            <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="h-9 w-72 text-xs" />
          </div>
          <Button onClick={onAdd} className="h-9">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar centro de costo
          </Button>
        </div>
      </div>
    </div>
  );
}