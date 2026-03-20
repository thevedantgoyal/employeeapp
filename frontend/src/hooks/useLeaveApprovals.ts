import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";

export interface PendingLeave {
  id: string;
  employee_name: string;
  employee_email: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days_count: number;
  half_day: boolean;
  reason: string;
  attachment_url: string | null;
  created_at: string;
}

export const usePendingLeaves = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-leaves", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get employees managed by this user
      const { data: managerProfile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!managerProfile) return [];

      // Get leaves from direct reports
      const { data: employees } = await db
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("manager_id", managerProfile.id);

      if (!employees || employees.length === 0) return [];

      const employeeUserIds = employees.map((e) => e.user_id);

      const { data: leaves, error } = await db
        .from("leaves")
        .select("*, leave_types!inner(name)")
        .in("user_id", employeeUserIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (leaves || []).map((leave: Record<string, unknown>) => {
        const emp = employees.find((e) => e.user_id === leave.user_id);
        return {
          id: leave.id,
          employee_name: emp?.full_name || "Unknown",
          employee_email: emp?.email || "",
          leave_type: (leave.leave_types as { name?: string })?.name ?? "",
          from_date: leave.from_date,
          to_date: leave.to_date,
          days_count: Number(leave.days_count),
          half_day: leave.half_day,
          reason: leave.reason,
          attachment_url: leave.attachment_url,
          created_at: leave.created_at,
        } as PendingLeave;
      });
    },
    enabled: !!user,
  });
};

export const useApproveLeave = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      queryClient.invalidateQueries({ queryKey: ["pending-leaves", user?.id] });
    },
  });
};

export const useRejectLeave = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ leaveId, comment }: { leaveId: string; comment?: string }) => {
      const { data, error } = await db.rpc("reject_leave", {
        _leave_id: leaveId,
        _approver_comment: comment || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leaves", user?.id] });
    },
  });
};
