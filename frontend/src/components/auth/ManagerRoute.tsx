import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

interface ManagerRouteProps {
  children: React.ReactNode;
}

export const ManagerRoute = ({ children }: ManagerRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <ConnectPlusLoader variant="fullscreen" />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const userType = (user as { userType?: string } | null)?.userType;
  if (userType !== "MANAGER" && userType !== "SENIOR_MANAGER") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
