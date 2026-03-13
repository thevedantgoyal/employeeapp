import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";

export type AppRole = "employee" | "team_lead" | "manager" | "hr" | "admin" | "organization";

interface UseUserRolesReturn {
  roles: AppRole[];
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
  isTeamLead: boolean;
  isEmployee: boolean;
  isOrganization: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  loading: boolean;
}

export const useUserRoles = (): UseUserRolesReturn => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching roles:", error);
          setRoles([]);
        } else {
          const list = (data as { role: string }[] | null | undefined) ?? [];
          setRoles(list.map((r) => r.role as AppRole));
        }
      } catch (err) {
        console.error("Error:", err);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some((r) => roles.includes(r));

  return {
    roles,
    isAdmin: hasRole("admin"),
    isManager: hasRole("manager"),
    isHR: hasRole("hr"),
    isTeamLead: hasRole("team_lead"),
    isEmployee: hasRole("employee"),
    isOrganization: hasRole("organization"),
    hasRole,
    hasAnyRole,
    loading,
  };
};
