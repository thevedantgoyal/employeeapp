import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";
import { useUserRoles } from "@/hooks/useUserRoles";

export interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_email: string;
  employee_job_title: string | null;
  employee_code: string | null;
  employee_avatar_url: string | null;
  leave_type: string;
  from_date: string;
  to_date: string;
  days_count: number;
  half_day: boolean;
  reason: string;
  attachment_url: string | null;
  status: string;
  approver_comment: string | null;
  created_at: string;
  approved_at: string | null;
  can_action: boolean;
  has_manager: boolean;
}

export const useLeaveRequestsAccess = () => {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();

  const { data: hasReportees, isLoading } = useQuery({
    queryKey: ["has-reportees", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) return false;
      const { count } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", profile.id);
      return (count || 0) > 0;
    },
    enabled: !!user && !rolesLoading,
  });

  return {
    canView: isAdmin || !!hasReportees,
    isAdmin,
    isManager: !!hasReportees,
    loading: isLoading || rolesLoading,
  };
};

export const useLeaveRequests = () => {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: accessLoading } = useLeaveRequestsAccess();

  return useQuery({
    queryKey: ["leave-requests", user?.id, isAdmin, isManager],
    queryFn: async (): Promise<LeaveRequest[]> => {
      if (!user) return [];

      const { data: myProfile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!myProfile) return [];
      const myProfileId = myProfile.id;

      let leaves: Record<string, unknown>[] = [];
      let directReportUserIds: string[] = [];

      if (isAdmin) {
        // Admin sees ALL leaves
        const { data, error } = await db
          .from("leaves")
          .select("*, leave_types!inner(name)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        leaves = data || [];
      } else if (isManager) {
        // Manager sees only direct reportees
        const { data: employees } = await db
          .from("profiles")
          .select("user_id")
          .eq("manager_id", myProfileId);
        if (!employees || employees.length === 0) return [];

        directReportUserIds = employees.map((e) => String(e.user_id ?? ""));
        const { data, error } = await db
          .from("leaves")
          .select("*, leave_types!inner(name)")
          .in("user_id", directReportUserIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        leaves = data || [];
      }

      // Batch fetch profiles for all leave user_ids (manager gets reportees; admin gets all)
      const userIds = [...new Set(leaves.map((l) => l.user_id))];
      let employeeProfiles: Record<string, unknown>[] = [];
      if (userIds.length > 0) {
        const { data } = await db
          .from("profiles")
          .select("user_id, full_name, email, manager_id, job_title, employee_code, avatar_url")
          .in("user_id", userIds);
        employeeProfiles = data || [];
        console.log("[LeaveRequests] profile fetch user_ids:", userIds.length, "profiles received:", employeeProfiles?.length ?? 0);
      }

      const result = leaves.map((leave: Record<string, unknown>) => {
        const emp = employeeProfiles.find((e: Record<string, unknown>) => e.user_id === leave.user_id);
        const hasManager = !!emp?.manager_id;
        const leaveUserId = leave.user_id != null ? String(leave.user_id) : "";
        const isDirectReport = isManager && directReportUserIds.includes(leaveUserId);

        let canAction = false;
        if (leave.status === "pending") {
          if (isDirectReport && isManager) {
            canAction = true;
          } else if (isAdmin && !hasManager) {
            canAction = true;
          }
        }

        const employee_name = (emp?.full_name as string) || "Unknown";
        return {
          id: leave.id,
          employee_name,
          employee_email: (emp?.email as string) || "",
          employee_job_title: (emp?.job_title as string) ?? null,
          employee_code: (emp?.employee_code as string) ?? null,
          employee_avatar_url: (emp?.avatar_url as string) ?? null,
          leave_type: (leave.leave_types as { name?: string } | undefined)?.name || "Unknown",
          from_date: leave.from_date,
          to_date: leave.to_date,
          days_count: Number(leave.days_count),
          half_day: leave.half_day,
          reason: leave.reason,
          attachment_url: leave.attachment_url,
          status: leave.status,
          approver_comment: leave.approver_comment,
          created_at: leave.created_at,
          approved_at: leave.approved_at,
          can_action: canAction,
          has_manager: hasManager,
        };
      });

      console.log("[LeaveRequests] received:", result?.length ?? 0, "items");
      if (result.length > 0) {
        console.log("[LeaveRequests] first item:", result[0]);
        console.log("[LeaveRequests] employee_name:", result[0]?.employee_name);
      }
      return result;
    },
    enabled: !!user && !accessLoading && (isAdmin || isManager),
  });
};

export const useApproveLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leaveId, comment }: { leaveId: string; comment?: string }) => {
      const { data, error } = await db.rpc("approve_leave", {
        _leave_id: leaveId,
        _approver_comment: comment || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
    },
  });
};

export const useRejectLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leaveId, comment }: { leaveId: string; comment: string }) => {
      const { data, error } = await db.rpc("reject_leave", {
        _leave_id: leaveId,
        _approver_comment: comment,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
    },
  });
};
