import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, EyeOff, Layers, Pencil, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertaCuentas, useCuentasSinClasificar, useGruposPyg, clasificarCuenta } from "@/hooks/useClasificacion";
import type { CuentaSinClasificar } from "@/hooks/useClasificacion";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/dashboard/StateMessages";
import { formatCOP } from "@/lib/format";
import ClasificarCuentaCell from "@/components/configuracion/ClasificarCuentaCell";
import CentrosCostoTab from "@/components/configuracion/CentrosCostoTab";
import EditarCuentaModal from "@/components/configuracion/EditarCuentaModal";

const BALANCE_CLASES = new Set(["1", "2", "3", "7", "8", "9"]);

export default function Configuracion() {
  const qc = useQueryClient();
  const { data: alerta } = useAlertaCuentas();
  const { data: grupos = [] } = useGruposPyg();

  const [claseFilter, setClaseFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGrupo, setBulkGrupo] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Estado del modal de edición
  const [cuentaEditar, setCuentaEditar] = useState<CuentaSinClasificar | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtros = useMemo(
    () => ({
      claseCod: claseFilter === "all" ? undefined : claseFilter,
      estado:
        estadoFilter === "sin"
          ? ("sin" as const)
          : estadoFilter === "clasificadas"
            ? ("clasificadas" as const)
            : estadoFilter === "ignoradas"
              ? ("ignoradas" as const)
              : undefined,
      search: search.trim() || undefined,
    }),
    [claseFilter, estadoFilter, search],
  );

  const { data: cuentas, isLoading, isError } = useCuentasSinClasificar(filtros);

  const toggleAll = (checked: boolean) => {
    if (!checked) return setSelected(new Set());
    const all = (cuentas ?? []).filter((c) => !BALANCE_CLASES.has(c.clase_cod ?? "")).map((c) => c.cuenta_key);
    setSelected(new Set(all));
  };
  const toggleOne = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  const refreshAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["cuentas_sin_clasificar"] }),
      qc.invalidateQueries({ queryKey: ["alerta_cuentas"] }),
    ]);

  const bulkClasificar = async () => {
    if (!bulkGrupo || selected.size === 0) {
      toast.error("Selecciona un grupo y al menos una cuenta");
      return;
    }
    setBulkBusy(true);
    try {
      const items = (cuentas ?? []).filter((c) => selected.has(c.cuenta_key));
      for (const c of items) {
        const signo = c.clase_cod === "4" ? 1 : -1;
        await clasificarCuenta({
          cuenta_key: c.cuenta_key,
          grupo_titulo: bulkGrupo,
          signo,
          ignorar: false,
        });
      }
      toast.success(`${items.length} cuentas clasificadas en ${bulkGrupo}`);
      setSelected(new Set());
      setBulkGrupo("");
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en clasificación masiva");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkIgnorar = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const items = (cuentas ?? []).filter((c) => selected.has(c.cuenta_key));
      for (const c of items) {
        await clasificarCuenta({
          cuenta_key: c.cuenta_key,
          grupo_titulo: null,
          signo: 0,
          ignorar: true,
        });
      }
      toast.success(`${items.length} cuentas ignoradas`);
      setSelected(new Set());
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al ignorar");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleEditar = (cuenta: CuentaSinClasificar) => {
    setCuentaEditar(cuenta);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCuentaEditar(null);
  };

  const pendientes = alerta?.pendientes_eri ?? 0;

  return (
    <AppLayout title="Configuración">
      <Tabs defaultValue="cuentas">
        <TabsList>
          <TabsTrigger value="cuentas">
            Cuentas sin clasificar
            {pendientes > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                {pendientes}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cc">Centros de Costo</TabsTrigger>
        </TabsList>

        <TabsContent value="cuentas" className="space-y-4">
          {pendientes > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertTitle className="text-amber-300">
                Cuentas nuevas detectadas{" "}
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                  {pendientes}
                </span>
              </AlertTitle>
              <AlertDescription className="text-amber-200/90">
                Hay {pendientes} cuentas nuevas detectadas que no están clasificadas en el ERI. Clasifícalas para que
                aparezcan correctamente en los reportes.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Pendientes ERI"
              value={alerta?.pendientes_eri ?? 0}
              tone="amber"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Clasificadas"
              value={alerta?.clasificadas ?? 0}
              tone="green"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Ignoradas (balance)"
              value={alerta?.ignoradas ?? 0}
              tone="gray"
              icon={<EyeOff className="h-4 w-4" />}
            />
            <StatCard
              label="Total detectadas"
              value={alerta?.total_detectadas ?? 0}
              tone="blue"
              icon={<Layers className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <Select value={claseFilter} onValueChange={setClaseFilter}>
              <SelectTrigger className="h-9 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las clases</SelectItem>
                <SelectItem value="4">4 - Ingresos</SelectItem>
                <SelectItem value="5">5 - Gastos</SelectItem>
                <SelectItem value="6">6 - Costos</SelectItem>
                <SelectItem value="BAL">Balance (ignoradas)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sin">Sin clasificar</SelectItem>
                <SelectItem value="clasificadas">Clasificadas</SelectItem>
                <SelectItem value="ignoradas">Ignoradas</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="h-9 w-72 pl-7 text-xs"
              />
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <span className="text-xs font-medium">{selected.size} seleccionadas</span>
              <Select value={bulkGrupo} onValueChange={setBulkGrupo}>
                <SelectTrigger className="h-8 w-60 text-xs">
                  <SelectValue placeholder="Clasificar seleccionadas en..." />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => (
                    <SelectItem key={g} value={g} className="text-xs">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={bulkClasificar} disabled={bulkBusy || !bulkGrupo}>
                Aplicar
              </Button>
              <Button size="sm" variant="outline" onClick={bulkIgnorar} disabled={bulkBusy}>
                Ignorar seleccionadas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Cancelar
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            {isLoading ? (
              <div className="p-6">
                <LoadingSkeleton className="h-40" />
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState />
              </div>
            ) : !cuentas || cuentas.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No hay cuentas que coincidan con los filtros" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={
                          selected.size > 0 &&
                          selected.size === cuentas.filter((c) => !BALANCE_CLASES.has(c.clase_cod ?? "")).length
                        }
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Cuenta PUC</TableHead>
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs text-right">Movs.</TableHead>
                    <TableHead className="text-xs text-right">Valor neto</TableHead>
                    <TableHead className="text-xs">Clasificar en ERI</TableHead>
                    <TableHead className="w-16 text-xs">Editar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((c) => {
                    const isBalance = BALANCE_CLASES.has(c.clase_cod ?? "");
                    const isClasif = !!c.en_plan_pyg;
                    const isIgnor = !!c.ignorada;
                    const borderColor = isClasif
                      ? "border-l-success"
                      : isIgnor || isBalance
                        ? "border-l-muted"
                        : "border-l-amber-500";
                    const rowClass = `border-l-2 ${borderColor} ${isIgnor || isBalance ? "opacity-70" : ""}`;
                    return (
                      <TableRow key={c.cuenta_key} className={rowClass}>
                        <TableCell>
                          {!isBalance && (
                            <Checkbox
                              checked={selected.has(c.cuenta_key)}
                              onCheckedChange={() => toggleOne(c.cuenta_key)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-400">{c.cuenta_key}</TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs" title={c.nombre_cuenta ?? ""}>
                          {c.nombre_cuenta ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.tipo_cuenta ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {(c.total_movimientos ?? 0).toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCOP(c.total_mov_neto ?? 0)}
                        </TableCell>
                        <TableCell>
                          {isBalance ? (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Balance — no aplica ERI
                            </span>
                          ) : isClasif ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {c.grupo_titulo_actual ?? "Clasificada"}
                            </span>
                          ) : (
                            <ClasificarCuentaCell cuenta={c} grupos={grupos} />
                          )}
                        </TableCell>
                        <TableCell>
                          {!isBalance && isClasif && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => handleEditar(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cc">
          <CentrosCostoTab />
        </TabsContent>
      </Tabs>

      <EditarCuentaModal cuenta={cuentaEditar} open={modalOpen} onClose={handleCloseModal} />
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "amber" | "green" | "gray" | "blue";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : tone === "green"
        ? "border-success/30 bg-success/10 text-success"
        : tone === "blue"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value.toLocaleString("es-CO")}</div>
    </div>
  );
}
