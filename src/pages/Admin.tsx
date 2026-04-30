import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Edit2,
  History,
  Pencil,
  RotateCcw,
  Shield,
  Trash2,
  Upload as UploadIcon,
  UserPlus,
  Users,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/dashboard/StateMessages";
import { formatCOP } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useEmpresas } from "@/hooks/useEmpresas";
import {
  cambiarEmpresa,
  cambiarRol,
  desactivarUsuario,
  editarMovimiento,
  eliminarMovimiento,
  revertirCargue,
  useAuditLog,
  useDistinctMeses,
  useHistorialCargues,
  useMovimientos,
  useUsuarios,
  type HistorialCargue,
  type MovimientoRow,
  type UsuarioRow,
} from "@/hooks/useAdmin";

export default function Admin() {
  return (
    <AppLayout title="Administración">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Panel de Administración</h2>
      </div>
      <Tabs defaultValue="cargues">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="cargues">Historial</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="cargues" className="mt-4"><HistorialTab /></TabsContent>
        <TabsContent value="usuarios" className="mt-4"><UsuariosTab /></TabsContent>
        <TabsContent value="movimientos" className="mt-4"><MovimientosTab /></TabsContent>
        <TabsContent value="auditoria" className="mt-4"><AuditoriaTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function fmtDate(s?: string | null) {
  if (!s) return "--";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(s?: string | null) {
  if (!s) return "--";
  const d = new Date(s);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "hace unos segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString("es-CO");
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    OK: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    REVERTIDO: "bg-muted text-muted-foreground border-border",
    ERROR: "bg-destructive/15 text-destructive border-destructive/30",
    PROCESANDO: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  const cls = map[estado] ?? "bg-secondary text-secondary-foreground";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{estado}</span>;
}

function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- TAB 1: Historial ----------------------------- */

function HistorialTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useHistorialCargues();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HistorialCargue | null>(null);
  const [working, setWorking] = useState(false);

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      enBd: rows.reduce((s, r) => s + (r.movimientos_actuales ?? 0), 0),
      ultimo: rows[0]?.created_at ?? null,
      revertidos: rows.filter((r) => r.estado === "REVERTIDO").length,
    };
  }, [data]);

  const handleRevertir = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      await revertirCargue(confirm.archivo_id);
      toast.success("Cargue revertido");
      qc.invalidateQueries({ queryKey: ["historial_cargues"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
      setConfirm(null);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al revertir");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total cargues" value={stats.total.toString()} />
        <StatCard label="Registros en BD" value={stats.enBd.toLocaleString("es-CO")} />
        <StatCard label="Último cargue" value={stats.ultimo ? relTime(stats.ultimo) : "--"} />
        <StatCard label="Cargues revertidos" value={stats.revertidos.toString()} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading && <LoadingSkeleton className="h-40" />}
        {isError && <ErrorState />}
        {!isLoading && !isError && (data?.length ?? 0) === 0 && <EmptyState message="Sin cargues registrados" />}
        {!isLoading && !isError && (data?.length ?? 0) > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead>Filas</TableHead>
                <TableHead>Mov. actuales</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((r) => {
                const color =
                  r.estado === "OK"
                    ? "text-emerald-400"
                    : r.estado === "REVERTIDO"
                    ? "text-destructive"
                    : r.estado === "ERROR"
                    ? "text-destructive"
                    : "text-amber-400";
                return (
                  <>
                    <TableRow key={r.archivo_id}>
                      <TableCell className={`max-w-[220px] truncate font-medium ${color}`}>{r.nombre_archivo}</TableCell>
                      <TableCell className="text-sm">{r.compania ?? "--"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="text-xs">{r.subido_por_email ?? "--"}</TableCell>
                      <TableCell className="text-xs">
                        {(r.filas_insertadas ?? 0).toLocaleString("es-CO")} / {(r.total_filas ?? 0).toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell>{(r.movimientos_actuales ?? 0).toLocaleString("es-CO")}</TableCell>
                      <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(expanded === r.archivo_id ? null : r.archivo_id)}
                        >
                          Ver detalle
                        </Button>
                        {r.puede_revertir && (
                          <Button variant="destructive" size="sm" onClick={() => setConfirm(r)}>
                            <RotateCcw className="h-3 w-3" /> Revertir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded === r.archivo_id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-background/40">
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div><span className="text-muted-foreground">Periodo: </span>{r.periodo ?? "--"}</div>
                            <div><span className="text-muted-foreground">Filas rechazadas: </span>{r.filas_rechazadas ?? 0}</div>
                            <div><span className="text-muted-foreground">Mensaje: </span>{r.mensaje_error ?? "--"}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="¿Revertir este cargue?"
        description={
          confirm
            ? `Se eliminarán ${(confirm.movimientos_actuales ?? 0).toLocaleString("es-CO")} registros de ${confirm.nombre_archivo}.`
            : undefined
        }
        confirmLabel="Sí, revertir"
        loading={working}
        onConfirm={handleRevertir}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

/* ----------------------------- TAB 2: Usuarios ----------------------------- */

function UsuariosTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, isError } = useUsuarios();
  const { data: empresas } = useEmpresas();
  const [confirmDeact, setConfirmDeact] = useState<UsuarioRow | null>(null);
  const [working, setWorking] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRol, setNewRol] = useState("viewer");
  const [newEmpresa, setNewEmpresa] = useState<string>("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["usuarios_admin"] });

  const handleRol = async (u: UsuarioRow, rol: string) => {
    if (u.id === user?.id) {
      toast.warning("No puedes cambiar tu propio rol");
      return;
    }
    try {
      await cambiarRol(u.id, rol);
      toast.success("Rol actualizado");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleEmpresa = async (u: UsuarioRow, empresa_id: string) => {
    try {
      await cambiarEmpresa(u.id, empresa_id || null);
      toast.success("Empresa actualizada");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeact = async () => {
    if (!confirmDeact) return;
    setWorking(true);
    try {
      await desactivarUsuario(confirmDeact.id, !confirmDeact.activo);
      toast.success(confirmDeact.activo ? "Usuario desactivado" : "Usuario activado");
      refresh();
      setConfirmDeact(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handleInvitar = () => {
    if (!newEmail) {
      toast.error("Ingresa un email");
      return;
    }
    toast.info(
      `Crea el usuario en Authentication > Users con el email: ${newEmail}, luego asigna rol y empresa.`,
      { duration: 8000 },
    );
  };

  const rolColor = (r: string | null) => {
    if (r === "admin") return "bg-destructive/15 text-destructive border-destructive/30";
    if (r === "contador") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        {isLoading && <LoadingSkeleton className="h-40" />}
        {isError && <ErrorState />}
        {!isLoading && !isError && (data?.length ?? 0) === 0 && <EmptyState message="Sin usuarios" />}
        {!isLoading && !isError && (data?.length ?? 0) > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cargues</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => {
                const initials = (u.nombre ?? u.email ?? "?").slice(0, 2).toUpperCase();
                const isMe = u.id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{u.nombre ?? "Sin nombre"}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.rol ?? "viewer"}
                        onValueChange={(v) => handleRol(u, v)}
                        disabled={isMe}
                      >
                        <SelectTrigger className={`h-8 w-32 border ${rolColor(u.rol)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="contador">contador</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      {isMe && <div className="mt-1 text-[9px] text-muted-foreground">No puedes cambiar tu propio rol</div>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.empresa_id ?? ""}
                        onValueChange={(v) => handleEmpresa(u, v)}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {(empresas ?? []).map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{u.total_cargues ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relTime(u.ultimo_acceso)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${u.activo ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeact(u)} disabled={isMe}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4" /> Invitar usuario</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="email@empresa.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Select value={newRol} onValueChange={setNewRol}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">viewer</SelectItem>
              <SelectItem value="contador">contador</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newEmpresa} onValueChange={setNewEmpresa}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              {(empresas ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleInvitar}>Crear usuario</Button>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmDeact}
        onOpenChange={(v) => !v && setConfirmDeact(null)}
        title={confirmDeact?.activo ? "¿Desactivar usuario?" : "¿Activar usuario?"}
        description={confirmDeact?.email ?? undefined}
        confirmLabel={confirmDeact?.activo ? "Sí, desactivar" : "Sí, activar"}
        loading={working}
        onConfirm={handleDeact}
      />
    </div>
  );
}

/* ----------------------------- TAB 3: Movimientos ----------------------------- */

function MovimientosTab() {
  const qc = useQueryClient();
  const { data: empresas } = useEmpresas();
  const { data: meses } = useDistinctMeses();
  const [filtros, setFiltros] = useState<{ cuenta?: string; concepto?: string; compania?: string; añoMes?: number; page: number }>({ page: 0 });
  const [applied, setApplied] = useState(false);
  const { data, isLoading, isError, refetch } = useMovimientos(filtros, applied);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<MovimientoRow>>({});
  const [delTarget, setDelTarget] = useState<MovimientoRow | null>(null);
  const [delMotivo, setDelMotivo] = useState("");
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMotivo, setBulkMotivo] = useState("");

  const startEdit = (r: MovimientoRow) => {
    setEditingId(r.id);
    setEditBuf({ concepto: r.concepto, cc_key: r.cc_key, debito: r.debito, credito: r.credito });
  };

  const saveEdit = async (id: string) => {
    setWorking(true);
    try {
      await editarMovimiento(id, {
        concepto: editBuf.concepto ?? undefined,
        cc_key: editBuf.cc_key ?? undefined,
        debito: Number(editBuf.debito ?? 0),
        credito: Number(editBuf.credito ?? 0),
      });
      toast.success("Movimiento actualizado");
      setEditingId(null);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    if (!delMotivo.trim()) {
      toast.error("Ingresa un motivo");
      return;
    }
    setWorking(true);
    try {
      await eliminarMovimiento(delTarget.id, delMotivo);
      toast.success("Movimiento eliminado");
      setDelTarget(null);
      setDelMotivo("");
      refetch();
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkMotivo.trim()) {
      toast.error("Ingresa un motivo");
      return;
    }
    setWorking(true);
    try {
      for (const id of selected) await eliminarMovimiento(id, bulkMotivo);
      toast.success(`${selected.size} movimientos eliminados`);
      setSelected(new Set());
      setBulkOpen(false);
      setBulkMotivo("");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            placeholder="Cuenta PUC"
            value={filtros.cuenta ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, cuenta: e.target.value }))}
          />
          <Input
            placeholder="Concepto"
            value={filtros.concepto ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, concepto: e.target.value }))}
          />
          <Select value={filtros.compania ?? "_all"} onValueChange={(v) => setFiltros((f) => ({ ...f, compania: v === "_all" ? undefined : v }))}>
            <SelectTrigger><SelectValue placeholder="Compañía" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              {(empresas ?? []).map((e) => <SelectItem key={e.id} value={e.nombre}>{e.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filtros.añoMes ? String(filtros.añoMes) : "_all"}
            onValueChange={(v) => setFiltros((f) => ({ ...f, añoMes: v === "_all" ? undefined : Number(v) }))}
          >
            <SelectTrigger><SelectValue placeholder="Año/Mes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {(meses ?? []).map((m) => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setFiltros((f) => ({ ...f, page: 0 })); setApplied(true); }}>Buscar</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <div className="text-sm">{selected.size} seleccionados</div>
          <Button variant="destructive" size="sm" onClick={() => setBulkOpen(true)}>
            <Trash2 className="h-3 w-3" /> Eliminar seleccionados ({selected.size})
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        {!applied && <EmptyState message="Aplica filtros y presiona Buscar" />}
        {applied && isLoading && <LoadingSkeleton className="h-40" />}
        {applied && isError && <ErrorState />}
        {applied && !isLoading && !isError && (data?.rows.length ?? 0) === 0 && <EmptyState message="Sin resultados" />}
        {applied && !isLoading && !isError && (data?.rows.length ?? 0) > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={selected.size === data!.rows.length && data!.rows.length > 0}
                      onCheckedChange={(c) => setSelected(c ? new Set(data!.rows.map((r) => r.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>CC</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((r) => {
                  const editing = editingId === r.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      </TableCell>
                      <TableCell className="text-xs">{r.fecha}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-400">{r.cuenta_key}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">{r.nombre_cuenta ?? "--"}</TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        {editing ? (
                          <Input
                            value={editBuf.concepto ?? ""}
                            onChange={(e) => setEditBuf((b) => ({ ...b, concepto: e.target.value }))}
                            className="h-7"
                          />
                        ) : (
                          <span title={r.concepto ?? ""} className="truncate">{r.concepto ?? "--"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editing ? (
                          <Input
                            value={editBuf.cc_key ?? ""}
                            onChange={(e) => setEditBuf((b) => ({ ...b, cc_key: e.target.value }))}
                            className="h-7 w-20"
                          />
                        ) : (r.cc_key ?? "--")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {editing ? (
                          <Input
                            type="number"
                            value={editBuf.debito ?? 0}
                            onChange={(e) => setEditBuf((b) => ({ ...b, debito: Number(e.target.value) }))}
                            className="h-7 w-24"
                          />
                        ) : formatCOP(r.debito)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {editing ? (
                          <Input
                            type="number"
                            value={editBuf.credito ?? 0}
                            onChange={(e) => setEditBuf((b) => ({ ...b, credito: Number(e.target.value) }))}
                            className="h-7 w-24"
                          />
                        ) : formatCOP(r.credito)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${(r.mov_neto ?? 0) >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                        {formatCOP(r.mov_neto)}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        {editing ? (
                          <>
                            <Button size="sm" onClick={() => saveEdit(r.id)} disabled={working}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDelTarget(r)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border p-2 text-xs text-muted-foreground">
              <div>{data!.count.toLocaleString("es-CO")} resultados totales</div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={(filtros.page ?? 0) === 0}
                  onClick={() => setFiltros((f) => ({ ...f, page: Math.max(0, (f.page ?? 0) - 1) }))}
                >Anterior</Button>
                <span>Página {(filtros.page ?? 0) + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={((filtros.page ?? 0) + 1) * 50 >= data!.count}
                  onClick={() => setFiltros((f) => ({ ...f, page: (f.page ?? 0) + 1 }))}
                >Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!delTarget}
        onOpenChange={(v) => { if (!v) { setDelTarget(null); setDelMotivo(""); } }}
        title="¿Eliminar este movimiento?"
        confirmLabel="Sí, eliminar"
        loading={working}
        onConfirm={handleDelete}
      >
        {delTarget && (
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Cuenta: </span>{delTarget.cuenta_key}</div>
            <div><span className="text-muted-foreground">Fecha: </span>{delTarget.fecha}</div>
            <div><span className="text-muted-foreground">Concepto: </span>{delTarget.concepto}</div>
            <div><span className="text-muted-foreground">Valor neto: </span>{formatCOP(delTarget.mov_neto)}</div>
            <Input
              placeholder="Motivo de eliminación (requerido)"
              value={delMotivo}
              onChange={(e) => setDelMotivo(e.target.value)}
              className="mt-2"
            />
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={bulkOpen}
        onOpenChange={(v) => { if (!v) { setBulkOpen(false); setBulkMotivo(""); } }}
        title={`¿Eliminar ${selected.size} movimientos?`}
        confirmLabel="Sí, eliminar todos"
        loading={working}
        onConfirm={handleBulkDelete}
      >
        <Input
          placeholder="Motivo de eliminación (requerido)"
          value={bulkMotivo}
          onChange={(e) => setBulkMotivo(e.target.value)}
        />
      </ConfirmModal>
    </div>
  );
}

/* ----------------------------- TAB 4: Auditoría ----------------------------- */

function AuditoriaTab() {
  const { data, isLoading, isError } = useAuditLog();
  const [accion, setAccion] = useState<string>("_all");
  const [usuario, setUsuario] = useState<string>("_all");
  const [severidad, setSeveridad] = useState<string>("_all");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const usuarios = useMemo(() => {
    const set = new Set<string>();
    for (const r of data ?? []) if (r.usuario_email) set.add(r.usuario_email);
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (accion !== "_all" && r.accion !== accion) return false;
      if (usuario !== "_all" && r.usuario_email !== usuario) return false;
      if (severidad !== "_all" && r.severidad !== severidad) return false;
      if (desde && new Date(r.created_at) < new Date(desde)) return false;
      if (hasta && new Date(r.created_at) > new Date(hasta)) return false;
      return true;
    });
  }, [data, accion, usuario, severidad, desde, hasta]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const danger = (data ?? []).filter((r) => r.severidad === "danger" && new Date(r.created_at).getTime() >= monthStart).length;
    const users = new Set<string>();
    for (const r of data ?? []) if (new Date(r.created_at).getTime() >= monthStart && r.usuario_email) users.add(r.usuario_email);
    return {
      total: data?.length ?? 0,
      danger,
      users: users.size,
      ultima: data?.[0]?.created_at ?? null,
    };
  }, [data]);

  const sevColor = (s: string) => {
    if (s === "danger") return "border-destructive bg-destructive/10";
    if (s === "warning") return "border-amber-500 bg-amber-500/10";
    return "border-blue-500 bg-blue-500/10";
  };

  const iconFor = (icono: string | null, accion: string) => {
    if (icono === "trash" || accion.startsWith("ELIMINAR")) return <Trash2 className="h-4 w-4" />;
    if (icono === "edit" || accion.startsWith("EDITAR")) return <Edit2 className="h-4 w-4" />;
    if (icono === "user" || accion === "CAMBIAR_ROL") return <Users className="h-4 w-4" />;
    if (icono === "upload" || accion === "CARGAR") return <UploadIcon className="h-4 w-4" />;
    return <History className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total acciones" value={stats.total.toString()} />
        <StatCard label="Acciones peligrosas (mes)" value={stats.danger.toString()} />
        <StatCard label="Usuarios activos (mes)" value={stats.users.toString()} />
        <StatCard label="Última acción" value={stats.ultima ? relTime(stats.ultima) : "--"} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Select value={accion} onValueChange={setAccion}>
            <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas las acciones</SelectItem>
              <SelectItem value="CARGAR">CARGAR</SelectItem>
              <SelectItem value="ELIMINAR_CARGUE">ELIMINAR_CARGUE</SelectItem>
              <SelectItem value="EDITAR_MOV">EDITAR_MOV</SelectItem>
              <SelectItem value="ELIMINAR_MOV">ELIMINAR_MOV</SelectItem>
              <SelectItem value="CAMBIAR_ROL">CAMBIAR_ROL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los usuarios</SelectItem>
              {usuarios.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Select value={severidad} onValueChange={setSeveridad}>
            <SelectTrigger><SelectValue placeholder="Severidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas</SelectItem>
              <SelectItem value="danger">danger</SelectItem>
              <SelectItem value="warning">warning</SelectItem>
              <SelectItem value="info">info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        {isLoading && <LoadingSkeleton className="h-40" />}
        {isError && <ErrorState />}
        {!isLoading && !isError && filtered.length === 0 && <EmptyState message="Sin eventos de auditoría" />}
        {!isLoading && !isError && filtered.length > 0 && (
          <ol className="space-y-3">
            {filtered.map((e) => (
              <li key={e.id} className={`rounded-md border-l-4 bg-background/40 p-3 ${sevColor(e.severidad)}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-foreground">{iconFor(e.icono, e.accion)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">{e.accion}</Badge>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{e.usuario_email ?? "Sistema"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{relTime(e.created_at)}</span>
                      {(e.registros_afectados ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-auto">{e.registros_afectados} registros</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-foreground">{e.descripcion ?? "--"}</div>
                    {(e.valor_antes || e.valor_despues) && (
                      <button
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        className="mt-2 text-[11px] text-primary hover:underline"
                      >
                        {expanded === e.id ? "Ocultar detalle" : "Ver detalle"}
                      </button>
                    )}
                    {expanded === e.id && (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <pre className="rounded bg-background p-2 text-[10px] text-muted-foreground"><span className="text-destructive">Antes:</span>{"\n"}{JSON.stringify(e.valor_antes, null, 2)}</pre>
                        <pre className="rounded bg-background p-2 text-[10px] text-muted-foreground"><span className="text-emerald-400">Después:</span>{"\n"}{JSON.stringify(e.valor_despues, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}