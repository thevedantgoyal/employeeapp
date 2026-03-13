import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskActivityLog {
  id: string;
  task_id: string;
  action_type: string;
  performed_by: string;
  performer_name?: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export const useTaskActivityLogs = (taskId: string | null) => {
  return useQuery({
    queryKey: ["task-activity-logs", taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await db
        .from("task_activity_logs")
        .select("id, task_id, action_type, performed_by, old_value, new_value, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get performer names
      const performerIds = [...new Set(data?.map((l) => l.performed_by))] as string[];
      let nameMap = new Map<string, string>();
      if (performerIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name")
          .in("id", performerIds);
        nameMap = new Map(profiles?.map((p) => [p.id, p.full_name]));
      }

      return (data || []).map((log) => ({
        ...log,
        performer_name: nameMap.get(log.performed_by) || "Unknown",
        old_value: log.old_value as Record<string, unknown> | null,
        new_value: log.new_value as Record<string, unknown> | null,
      })) as TaskActivityLog[];
    },
    enabled: !!taskId,
  });
};

export const useInsertActivityLog = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      actionType,
      oldValue,
      newValue,
    }: {
      taskId: string;
      actionType: string;
      oldValue?: Record<string, unknown> | null;
      newValue?: Record<string, unknown> | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const { error } = await db.from("task_activity_logs").insert([{
        task_id: taskId,
        action_type: actionType,
        performed_by: profile.id,
        old_value: (oldValue || null) as unknown as import("@/types/db").Json,
        new_value: (newValue || null) as unknown as import("@/types/db").Json,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-activity-logs"] });
    },
  });
};
