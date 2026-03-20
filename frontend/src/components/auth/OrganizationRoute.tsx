import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

interface OrganizationRouteProps {
  children: ReactNode;
}

export const OrganizationRoute = ({ children }: OrganizationRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isOrganization, loading: rolesLoading } = useUserRoles();

  if (authLoading || rolesLoading) {
    return <ConnectPlusLoader variant="fullscreen" />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isOrganization) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
