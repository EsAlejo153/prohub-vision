import AppLayout from "@/components/layout/AppLayout";

export default function Balance() {
  return (
    <AppLayout title="Balance General">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Balance General</h2>
        <p className="mt-2 text-sm text-muted-foreground">Pendiente de conexión con datos reales.</p>
      </div>
    </AppLayout>
  );
}
