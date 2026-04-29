import AppLayout from "@/components/layout/AppLayout";
import { Upload } from "lucide-react";

export default function Cargue() {
  return (
    <AppLayout title="Cargue de Datos">
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Cargue de archivos contables</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Arrastra archivos Excel o CSV para procesar (próximamente).
        </p>
      </div>
    </AppLayout>
  );
}
