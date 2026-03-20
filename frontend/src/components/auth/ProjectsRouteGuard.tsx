import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSubadmin } from "@/lib/authUtils";
import EmployeeProjectsPage from "@/pages/EmployeeProjectsPage";

/**
 * Renders Projects page for non-subadmins; redirects subadmins to dashboard.
 * Subadmin = external_role === 'subadmin' OR external_sub_role set (CEO, CTO, Director, VP, CFO, HR, etc.)
 */
export const ProjectsRouteGuard = () => {
  const { user } = useAuth();
  if (isSubadmin(user)) {
    return <Navigate to="/" replace />;
  }
  return <EmployeeProjectsPage />;
};
