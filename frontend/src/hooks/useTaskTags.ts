import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface TaskTagAssignment {
  id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string;
}

export const useAllTags = () => {
  return useQuery({
    queryKey: ["task-tags"],
    queryFn: async () => {
      const { data, error } = await db
        .from("task_tags")
        .select("id, name, color")
        .order("name");
      if (error) throw error;
      return data as TaskTag[];
    },
  });
};

export const useTaskTagAssignments = (taskId: string | null) => {
  return useQuery({
    queryKey: ["task-tag-assignments", taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await db
        .from("task_tag_assignments")
        .select("id, tag_id")
        .eq("task_id", taskId);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      const tagIds = data.map(a => a.tag_id);
      const { data: tags } = await db
        .from("task_tags")
        .select("id, name, color")
        .in("id", tagIds);

      const tagMap = new Map(tags?.map(t => [t.id, t]));

      return data.map(a => ({
        id: a.id,
        tag_id: a.tag_id,
        tag_name: tagMap.get(a.tag_id)?.name || "Unknown",
        tag_color: tagMap.get(a.tag_id)?.color || "#6366f1",
      }));
    },
    enabled: !!taskId,
  });
};

/** Returns Map of taskId -> tag_id[] for filtering tasks by tag. */
export const useTaskTagAssignmentsForTaskIds = (taskIds: string[]) => {
  const key = [...taskIds].sort().join(",");
  return useQuery({
    queryKey: ["task-tag-assignments-bulk", key],
    queryFn: async () => {
      if (taskIds.length === 0) return new Map<string, string[]>();

      const { data, error } = await db
        .from("task_tag_assignments")
        .select("task_id, tag_id")
        .in("task_id", taskIds);

      if (error) throw error;
      if (!data || data.length === 0) return new Map<string, string[]>();

      const map = new Map<string, string[]>();
      for (const row of data as { task_id: string; tag_id: string }[]) {
        const arr = map.get(row.task_id) ?? [];
        if (!arr.includes(row.tag_id)) arr.push(row.tag_id);
        map.set(row.task_id, arr);
      }
      return map;
    },
    enabled: taskIds.length > 0,
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error } = await db
        .from("task_tags")
        .insert([{ name, color, created_by: profile?.id || null }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-tags"] });
    },
  });
};

export const useAssignTag = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await db
        .from("task_tag_assignments")
        .insert([{ task_id: taskId, tag_id: tagId, assigned_by: profile?.id || null }]);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task-tag-assignments", vars.taskId] });
    },
  });
};

export const useRemoveTagAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }) => {
      const { error } = await db
        .from("task_tag_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return taskId;
    },
    onSuccess: (taskId) => {
      queryClient.invalidateQueries({ queryKey: ["task-tag-assignments", taskId] });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await db
        .from("task_tags")
        .delete()
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-tags"] });
      queryClient.invalidateQueries({ queryKey: ["task-tag-assignments"] });
    },
  });
};
