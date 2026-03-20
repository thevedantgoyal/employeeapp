import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isPast } from "date-fns";

export interface HomeTask {
  id: string;
  title: string;
  description: string | null;
  project_name: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  task_date?: string | null;
  duration_hours?: number | null;
}

export interface HomeStats {
  activeTasks: number;
  pending: number;
  completed: number;
  approved: number;
  inReview: number;
}

export const useHomeTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["home-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return [];

      const { data, error } = await db
        .from("tasks")
        .select(`
          id, title, description, due_date, priority, status, project_id,
          task_date, duration_hours,
          projects (name)
        `)
        .eq("assigned_to", profile.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(3);

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      return list.map((task: Record<string, unknown>) => ({
        id: task.id ?? "",
        title: task.title ?? "",
        description: task.description ?? null,
        project_name: (task.projects as { name?: string } | undefined)?.name || "No Project",
        due_date: task.due_date ?? null,
        priority: task.priority ?? null,
        status: (task.status as string) ?? null,
        task_date: task.task_date ?? null,
        duration_hours: task.duration_hours != null ? Number(task.duration_hours) : null,
      }));
    },
    enabled: !!user,
  });
};

export const useHomeStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["home-stats", user?.id],
    queryFn: async () => {
      if (!user) return { activeTasks: 0, pending: 0, completed: 0, approved: 0, inReview: 0 };

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileId = (profile as { id?: string } | null)?.id;
      if (!profileId) return { activeTasks: 0, pending: 0, completed: 0, approved: 0, inReview: 0 };

      // Single query: tasks assigned to current user (backend excludes createdBy === currentUser for managers)
      const { data: taskRows, error } = await db
        .from("tasks")
        .select("id, status")
        .eq("assigned_to", profileId)
        .eq("is_deleted", false);

      if (error) return { activeTasks: 0, pending: 0, completed: 0, approved: 0, inReview: 0 };
      const list = Array.isArray(taskRows) ? taskRows : [];
      const statuses = list.map((t: { status?: string }) => t.status);

      const activeTasks = statuses.filter((s) => s === "in_progress" || s === "active").length;
      const pending = statuses.filter((s) => s === "pending").length;
      const completed = statuses.filter((s) => s === "completed" || s === "done").length;
      const approved = statuses.filter((s) => s === "approved").length;
      const inReview = statuses.filter((s) => s === "review" || s === "in_review").length;

      return { activeTasks, pending, completed, approved, inReview };
    },
    enabled: !!user,
  });
};

export const formatDueLabel = (dueDate: string | null): string => {
  if (!dueDate) return "No due date";
  
  const date = new Date(dueDate);
  if (isPast(date)) {
    return "Overdue";
  }
  
  return `Due ${formatDistanceToNow(date, { addSuffix: true })}`;
};
