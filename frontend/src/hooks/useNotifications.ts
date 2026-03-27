import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/api/client";
import { db } from "@/integrations/api/db";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

function isNotFoundError(message?: string | null) {
  return (message || "").toLowerCase().includes("not found");
}

function normalizeNotification(raw: Record<string, unknown>): Notification {
  return {
    id: String(raw.id || ""),
    type: String(raw.type || "general"),
    title: String(raw.title || ""),
    message: String(raw.message || ""),
    is_read: Boolean(raw.is_read ?? raw.read ?? false),
    link: raw.link == null ? null : String(raw.link),
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasLoadedList, setHasLoadedList] = useState(false);
  const [useLegacyNotificationsApi, setUseLegacyNotificationsApi] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    if (useLegacyNotificationsApi) {
      const byRead = await db
        .from("notifications")
        .select("*", { count: "exact", head: true } as unknown as undefined)
        .eq("user_id", user.id)
        .eq("read", false);
      if (!byRead.error) {
        setUnreadCount(Number((byRead as unknown as { count?: number }).count || 0));
        return;
      }
      const byIsRead = await db
        .from("notifications")
        .select("*", { count: "exact", head: true } as unknown as undefined)
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (!byIsRead.error) {
        setUnreadCount(Number((byIsRead as unknown as { count?: number }).count || 0));
      }
      return;
    }
    const { data, error: reqError } = await api.get<{ count: number }>("/notifications/unread-count");
    if (!reqError) {
      setUnreadCount(data?.count ?? 0);
      return;
    }
    if (!isNotFoundError(reqError.message)) return;
    setUseLegacyNotificationsApi(true);

    // Fallback for deployments that don't have /api/notifications/* routes yet.
    const byRead = await db
      .from("notifications")
      .select("*", { count: "exact", head: true } as unknown as undefined)
      .eq("user_id", user.id)
      .eq("read", false);
    if (!byRead.error) {
      setUnreadCount(Number((byRead as unknown as { count?: number }).count || 0));
      return;
    }
    const byIsRead = await db
      .from("notifications")
      .select("*", { count: "exact", head: true } as unknown as undefined)
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (!byIsRead.error) {
      setUnreadCount(Number((byIsRead as unknown as { count?: number }).count || 0));
    }
  }, [user, useLegacyNotificationsApi]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    if (useLegacyNotificationsApi) {
      const { data: legacyData, error: legacyError } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacyError) {
        setError("Could not load notifications.");
        setLoading(false);
        return;
      }
      const mapped = Array.isArray(legacyData)
        ? legacyData.map((n) => normalizeNotification(n as unknown as Record<string, unknown>))
        : [];
      setNotifications(mapped);
      setHasLoadedList(true);
      setLoading(false);
      return;
    }
    const { data, error: reqError } = await api.get<Notification[]>("/notifications");
    if (!reqError) {
      setNotifications((data || []).map((n) => ({ ...n, is_read: !!n.is_read })));
      setHasLoadedList(true);
      setLoading(false);
      return;
    }

    if (!isNotFoundError(reqError.message)) {
      setError("Could not load notifications.");
      setLoading(false);
      return;
    }
    setUseLegacyNotificationsApi(true);

    // Fallback to legacy data endpoint.
    const { data: legacyData, error: legacyError } = await db
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (legacyError) {
      setError("Could not load notifications.");
      setLoading(false);
      return;
    }
    const mapped = Array.isArray(legacyData)
      ? legacyData.map((n) => normalizeNotification(n as unknown as Record<string, unknown>))
      : [];
    setNotifications(mapped);
    setHasLoadedList(true);
    setLoading(false);
  }, [user, useLegacyNotificationsApi]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsDrawerOpen(false);
      setHasLoadedList(false);
      setUseLegacyNotificationsApi(false);
      return;
    }
    fetchUnreadCount();
    const id = window.setInterval(fetchUnreadCount, 30000);
    return () => window.clearInterval(id);
  }, [user, fetchUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    const n = notifications.find((item) => item.id === id);
    if (!n || n.is_read) return;
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    if (useLegacyNotificationsApi) {
      const setIsRead = await db.from("notifications").update({ is_read: true }).eq("id", id);
      if (!setIsRead.error) return;
      const setRead = await db.from("notifications").update({ read: true }).eq("id", id);
      if (!setRead.error) return;
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: false } : item)));
      setUnreadCount((prev) => prev + 1);
      return;
    }
    const { error: reqError } = await api.patch(`/notifications/${id}/read`);
    if (reqError) {
      // Fallback for backend deployments missing dedicated routes.
      if (isNotFoundError(reqError.message)) {
        setUseLegacyNotificationsApi(true);
        const setIsRead = await db.from("notifications").update({ is_read: true }).eq("id", id);
        if (!setIsRead.error) return;
        const setRead = await db.from("notifications").update({ read: true }).eq("id", id);
        if (!setRead.error) return;
      }
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: false } : item)));
      setUnreadCount((prev) => prev + 1);
    }
  }, [notifications, useLegacyNotificationsApi]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    if (useLegacyNotificationsApi && user) {
      const withRead = await db.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      if (!withRead.error) return;
      const withIsRead = await db.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      if (!withIsRead.error) return;
      await fetchNotifications();
      await fetchUnreadCount();
      return;
    }
    const { error: reqError } = await api.patch("/notifications/read-all");
    if (reqError) {
      if (isNotFoundError(reqError.message) && user) {
        setUseLegacyNotificationsApi(true);
        const withRead = await db.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
        if (!withRead.error) return;
        const withIsRead = await db.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
        if (!withIsRead.error) return;
      }
      await fetchNotifications();
      await fetchUnreadCount();
    }
  }, [fetchNotifications, fetchUnreadCount, user, useLegacyNotificationsApi]);

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
    if (!hasLoadedList && !loading) {
      fetchNotifications();
    }
  }, [hasLoadedList, loading, fetchNotifications]);

  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const refetch = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  return useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    error,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    markAsRead,
    markAllAsRead,
    refetch,
  }), [notifications, unreadCount, loading, error, isDrawerOpen, openDrawer, closeDrawer, markAsRead, markAllAsRead, refetch]);
}

export const createNotification = async (
  userId: string,
  type: string,
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
  if (error) throw error;
};
