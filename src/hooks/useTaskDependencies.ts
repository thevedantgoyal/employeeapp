import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on: string;
  dependency_type: string;
  depends_on_title?: string;
  depends_on_status?: string | null;
}

export const useTaskDependencies = (taskId: string | null) => {
  return useQuery({
    queryKey: ["task-dependencies", taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await db
        .from("task_dependencies")
        .select("id, task_id, depends_on, dependency_type")
        .eq("task_id", taskId);

      if (error) throw error;

      // Get dependency task details
      const depIds = data?.map(d => d.depends_on) || [];
      if (depIds.length === 0) return [];

      const { data: tasks } = await db
        .from("tasks")
        .select("id, title, status")
        .in("id", depIds);

      const taskMap = new Map(tasks?.map(t => [t.id, t]));

      return data.map(d => ({
        ...d,
        depends_on_title: taskMap.get(d.depends_on)?.title || "Unknown",
        depends_on_status: taskMap.get(d.depends_on)?.status || null,
      }));
    },
    enabled: !!taskId,
  });
};

export const useAddDependency = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      dependsOn,
      dependencyType = "blocks",
    }: {
      taskId: string;
      dependsOn: string;
      dependencyType?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await db
        .from("task_dependencies")
        .insert([{
          task_id: taskId,
          depends_on: dependsOn,
          dependency_type: dependencyType,
          created_by: profile?.id || null,
        }]);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", vars.taskId] });
    },
  });
};

export const useRemoveDependency = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }) => {
      const { error } = await db
        .from("task_dependencies")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return taskId;
    },
    onSuccess: (taskId) => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", taskId] });
    },
  });
};
