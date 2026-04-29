import AppLayout from "@/components/layout/AppLayout";

export default function Configuracion() {
  return (
    <AppLayout title="Configuración">
      <div className="rounded-lg border border-border bg-card p-8">
        <h2 className="text-lg font-semibold text-foreground">Configuración</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ajustes generales del panel.</p>
      </div>
    </AppLayout>
  );
}
