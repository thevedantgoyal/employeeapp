import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/integrations/api/db";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      try {
        const { data, error } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error checking admin role:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error("Error:", err);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    };

    if (!loading) {
      checkAdminRole();
    }
  }, [user, loading]);

  if (loading || checkingRole) {
    return <ConnectPlusLoader variant="fullscreen" message="Checking permissions..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
