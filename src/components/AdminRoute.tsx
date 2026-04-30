import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePerfil } from "@/hooks/useAdmin";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: perfil, isLoading } = usePerfil(user?.id);

  const denied = !loading && !isLoading && perfil && perfil.rol !== "admin";

  useEffect(() => {
    if (denied) toast.error("Acceso denegado");
  }, [denied]);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (denied) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}