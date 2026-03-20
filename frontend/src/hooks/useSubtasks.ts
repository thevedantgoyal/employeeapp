import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface Subtask {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to_name: string | null;
}

export const useSubtasks = (parentTaskId: string | null) => {
  return useQuery({
    queryKey: ["subtasks", parentTaskId],
    queryFn: async () => {
      if (!parentTaskId) return [];

      const { data, error } = await db
        .from("tasks")
        .select(`
          id, title, status, priority, due_date, assigned_to,
          is_deleted
        `)
        .eq("parent_task_id", parentTaskId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const taskList = (data as { id: string; title: string; status: string | null; priority: string | null; due_date: string | null; assigned_to: string | null }[]) ?? [];
      const assigneeIds = [...new Set(taskList.map((t) => t.assigned_to).filter(Boolean))] as string[];
      let profileMap = new Map<string, string>();
      if (assigneeIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name")
          .in("id", assigneeIds);
        const profileList = (profiles as { id: string; full_name: string }[]) ?? [];
        profileMap = new Map(profileList.map((p) => [p.id, p.full_name]));
      }

      return taskList.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        assigned_to_name: t.assigned_to ? profileMap.get(t.assigned_to) || null : null,
      }));
    },
    enabled: !!parentTaskId,
  });
};

export const useCreateSubtask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      parentTaskId,
      title,
      priority,
      dueDate,
    }: {
      parentTaskId: string;
      title: string;
      priority?: string;
      dueDate?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileId = (profile as { id?: string } | null)?.id ?? null;
      const { data, error } = await db
        .from("tasks")
        .insert([{
          title,
          parent_task_id: parentTaskId,
          priority: priority || "medium",
          due_date: dueDate || null,
          status: "pending",
          assigned_by: profileId,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", vars.parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
