import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_own: boolean;
}

export const useTaskComments = (taskId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await db
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const authorIds = [...new Set(data?.map((c) => c.author_id))] as string[];
      let authorMap = new Map<string, { full_name: string; avatar_url: string | null; user_id: string }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name, avatar_url, user_id")
          .in("id", authorIds);
        authorMap = new Map(profiles?.map((p) => [p.id, p]));
      }

      return (data || []).map((c) => {
        const author = authorMap.get(c.author_id);
        return {
          ...c,
          author_name: author?.full_name || "Unknown",
          author_avatar: author?.avatar_url || null,
          is_own: author?.user_id === user?.id,
        };
      }) as TaskComment[];
    },
    enabled: !!taskId,
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const { error } = await db.from("task_comments").insert({
        task_id: taskId,
        author_id: profile.id,
        content,
      });

      if (error) throw error;

      // Log activity
      await db.from("task_activity_logs").insert({
        task_id: taskId,
        action_type: "comment_added",
        performed_by: profile.id,
        new_value: { content: content.substring(0, 100) },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
      queryClient.invalidateQueries({ queryKey: ["task-activity-logs"] });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await db
        .from("task_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });
};
