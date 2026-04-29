export function LoadingSkeleton({ className = "h-full w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-background/40 ${className}`} />;
}

export function EmptyState({ message = "Sin datos para el período seleccionado" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export function ErrorState({ message = "No se pudieron cargar los datos. Intenta de nuevo." }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-xs text-destructive">
      {message}
    </div>
  );
}
