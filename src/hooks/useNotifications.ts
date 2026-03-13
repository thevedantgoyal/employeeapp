import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";

export interface Notification {
  id: string;
  user_id: string;
  type: "task_assigned" | "contribution_approved" | "contribution_rejected" | "role_changed" | "team_assigned" | "general";
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscriptions (db.channel) are not supported by the Node API client.
  // Notifications are refetched when the query is invalidated or when the user changes.
  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });
};

export const useUnreadCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await db
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await db
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await db
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await db
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await db
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    },
  });
};

// Helper to create notifications (called from other parts of the app)
export const createNotification = async (
  userId: string,
  type: Notification["type"],
  title: string,
  message: string,
  metadata: object = {}
) => {
  const { error } = await db.from("notifications").insert([{
    user_id: userId,
    type,
    title,
    message,
    metadata: metadata as unknown as undefined,
  }]);

  if (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
};
