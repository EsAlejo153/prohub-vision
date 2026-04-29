import AppLayout from "@/components/layout/AppLayout";

export default function Eri() {
  return (
    <AppLayout title="Estado de Resultados">
      <PlaceholderPanel title="Estado de Resultados Integral (ERI)" description="Pendiente de conexión con datos reales." />
    </AppLayout>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
