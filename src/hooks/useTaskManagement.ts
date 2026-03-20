import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendTaskAssignedEmail } from "@/hooks/useEmailNotifications";
import { sendPushNotification } from "@/hooks/usePushNotifications";

function parseDurationHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim().replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
}

/** Assignable user for standalone task (employees + regular managers; excludes subadmin, external_sub_role, self) */
export interface AssignableUser {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  department: string | null;
  external_role: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface ManagedTask {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  assigned_to_name: string | null;
  assigned_to_id: string | null;
  project_name: string | null;
  task_type: string | null;
  blocked_reason: string | null;
  reassignment_count: number;
  task_date?: string | null;
  duration_hours?: number | null;
}

// Fetch team members that the current user manages (direct reports) or all employees (admin/hr/subadmin with no manager)
export const useTeamMembers = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-members", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get current user's profile (id + external_role for manager/subadmin)
      const { data: managerProfile } = await db
        .from("profiles")
        .select("id, external_role, manager_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!managerProfile) return [];

      const profileId = (managerProfile as { id: string }).id;
      const externalRole = (managerProfile as { external_role?: string | null }).external_role?.toString().trim().toLowerCase() || "";
      const hasManager = !!(managerProfile as { manager_id?: string | null }).manager_id;

      // Check if user has manager/admin/hr roles (from user_roles or profile.external_role)
      const { data: roles } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map((r) => (r as { role: string }).role) || [];
      const canViewAll =
        userRoles.includes("hr") ||
        userRoles.includes("admin") ||
        (externalRole === "subadmin" && !hasManager);
      const isManager =
        userRoles.includes("manager") ||
        userRoles.includes("team_lead") ||
        externalRole === "manager" ||
        externalRole === "subadmin";

      if (!canViewAll && !isManager) return [];

      // Fetch team members: all employees for admin/hr/senior-manager, else direct reports (profiles where manager_id = my profile id)
      let q = db.from("profiles").select("id, user_id, full_name, email, job_title");

      if (!canViewAll) {
        q = q.eq("manager_id", profileId);
      }

      const { data, error } = await q.order("full_name");

      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: !!user,
  });
};

/** Manager standalone task: direct reports + peer managers. Excludes self, subadmins. */
export const useAssignableUsers = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignable-users", user?.id],
    queryFn: async (): Promise<AssignableUser[]> => {
      if (!user) return [];
      const { data, error } = await api.get<AssignableUser[]>("/users/assignable");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
};

/** Subadmin standalone task: employees + managers + other subadmins. Excludes self, admin. */
export const useAssignableAll = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignable-all", user?.id],
    queryFn: async (): Promise<(AssignableUser & { external_sub_role?: string | null })[]> => {
      if (!user) return [];
      const { data, error } = await api.get<AssignableUser[]>("/users/assignable/all");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
};

// Fetch available projects
export const useProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await db
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });
};

// Fetch tasks created/managed by the current user
export const useManagedTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["managed-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get manager's profile (id and external_role for manager/subadmin)
      const { data: managerProfile } = await db
        .from("profiles")
        .select("id, external_role, manager_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!managerProfile) return [];

      const externalRole = (managerProfile as { external_role?: string | null }).external_role?.toString().trim().toLowerCase() || "";
      const hasManager = !!(managerProfile as { manager_id?: string | null }).manager_id;

      // Check roles (user_roles + profile.external_role)
      const { data: roles } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map((r) => (r as { role: string }).role) || [];
      const canViewAll = userRoles.includes("hr") || userRoles.includes("admin");
      const isManager =
        userRoles.includes("manager") ||
        userRoles.includes("team_lead") ||
        externalRole === "manager" ||
        externalRole === "subadmin";

      if (!canViewAll && !isManager) return [];

      // Fetch tasks (exclude soft-deleted)
      const { data: tasks, error } = await db
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          task_date,
          duration_hours,
          created_at,
          assigned_to,
          task_type,
          blocked_reason,
          reassignment_count,
          is_deleted,
          projects (name)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get assignee info
      const assignedToIds = [...new Set(tasks?.map((t) => t.assigned_to).filter(Boolean))] as string[];

      let profileMap = new Map<string, { full_name: string; manager_id: string | null }>();

      if (assignedToIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name, manager_id")
          .in("id", assignedToIds);

        profileMap = new Map(profiles?.map((p) => [p.id, { full_name: p.full_name, manager_id: p.manager_id }]));
      }

      // Backend already restricted to allowed tasks (direct reports + unassigned by manager); show all returned
      const list = tasks ?? [];
      return list.map((task: Record<string, unknown>) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        created_at: task.created_at,
        assigned_to_id: task.assigned_to,
        assigned_to_name: task.assigned_to ? profileMap.get(task.assigned_to)?.full_name || null : null,
        project_name: (task.projects as { name?: string } | undefined)?.name ?? null,
        task_type: task.task_type || "project_task",
        blocked_reason: task.blocked_reason || null,
        reassignment_count: task.reassignment_count || 0,
        task_date: task.task_date ?? null,
        duration_hours: task.duration_hours != null ? Number(task.duration_hours) : null,
      }));
    },
    enabled: !!user,
  });
};

// Create a new task (single or multiple assignees — one task per assignee)
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      assignedTo,
      projectId,
      priority,
      dueDate,
      taskType,
      assignMode,
      taskDate,
      durationHours,
    }: {
      title: string;
      description?: string;
      assignedTo?: string | string[];
      projectId?: string;
      priority?: string;
      dueDate?: string;
      taskType?: "project_task" | "separate_task";
      assignMode?: "individual" | "shared";
      taskDate?: string;
      durationHours?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: managerProfile } = await db
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const now = new Date().toISOString();
      const assigneeIds = Array.isArray(assignedTo)
        ? assignedTo.filter(Boolean)
        : assignedTo
          ? [assignedTo]
          : [];

      if (assigneeIds.length > 1) {
        const body: Record<string, unknown> = {
          title,
          description: description || null,
          assigned_to: assigneeIds,
          assigned_by: managerProfile?.id || null,
          assigned_at: now,
          project_id: projectId || null,
          task_type: taskType === "separate_task" ? "separate_task" : "project_task",
          priority: priority || "medium",
          due_date: dueDate || null,
          status: "pending",
          task_date: null,
          duration_hours: null,
        };
        if (assignMode) body.assignMode = assignMode;
        if (taskDate) body.task_date = taskDate;
        const parsedDuration = parseDurationHours(durationHours);
        if (parsedDuration != null) {
          body.duration_hours = parsedDuration;
          if (!body.task_date && dueDate) body.task_date = String(dueDate).slice(0, 10);
        }
        console.log("[CreateTask] payload:", body);
        const res = await api.post<{ id: string }[]>( "/data/tasks", body);
        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error("No tasks created");
        const createdRows = Array.isArray(res.data) ? res.data : [res.data];
        for (const profileId of assigneeIds) {
          const { data: assigneeProfile } = await db
            .from("profiles")
            .select("email, user_id")
            .eq("id", profileId)
            .maybeSingle();
          if (assigneeProfile?.email) {
            sendTaskAssignedEmail(assigneeProfile.email, title, managerProfile?.full_name).catch((e) => console.error(e));
          }
          if (assigneeProfile?.user_id) {
            sendPushNotification(assigneeProfile.user_id, "New Task Assigned 📋", `You've been assigned: "${title}"`, { url: "/tasks", tag: "task-assigned" }).catch((e) => console.error(e));
          }
        }
        return createdRows;
      }

      const singleId = assigneeIds[0] || null;
      const insertRow: Record<string, unknown> = {
        title,
        description: description || null,
        assigned_to: singleId,
        assigned_by: managerProfile?.id || null,
        assigned_at: singleId ? now : null,
        project_id: projectId || null,
        task_type: taskType === "separate_task" ? "separate_task" : "project_task",
        priority: priority || "medium",
        due_date: dueDate || null,
        status: "pending",
        task_date: null,
        duration_hours: null,
      };
      if (taskDate) insertRow.task_date = taskDate;
      const parsedDuration = parseDurationHours(durationHours);
      if (parsedDuration != null) {
        insertRow.duration_hours = parsedDuration;
        if (!insertRow.task_date && dueDate) insertRow.task_date = String(dueDate).slice(0, 10);
      }
      console.log("[CreateTask] payload:", insertRow);
      const { data, error } = await db
        .from("tasks")
        .insert([insertRow])
        .select()
        .single();

      if (error) throw error;

      if (singleId) {
        const { data: assigneeProfile } = await db
          .from("profiles")
          .select("email, user_id")
          .eq("id", singleId)
          .maybeSingle();
        if (assigneeProfile?.email) {
          sendTaskAssignedEmail(assigneeProfile.email, title, managerProfile?.full_name).catch((err) => console.error("Failed to send task assignment email:", err));
        }
        if (assigneeProfile?.user_id) {
          sendPushNotification(assigneeProfile.user_id, "New Task Assigned 📋", `You've been assigned: "${title}"`, { url: "/tasks", tag: "task-assigned" }).catch((err) => console.error("Failed to send task push notification:", err));
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-stats"] });
    },
  });
};

// Update task status
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      blockedReason,
    }: {
      taskId: string;
      status: string;
      blockedReason?: string;
    }) => {
      if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
        throw new Error("Task ID is required to update task status");
      }
      const updateData: Record<string, unknown> = { status };
      
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (status !== "approved") {
        updateData.completed_at = null;
      }

      if (status === "blocked" && blockedReason) {
        updateData.blocked_reason = blockedReason;
      } else if (status !== "blocked") {
        updateData.blocked_reason = null;
      }

      const { error } = await db
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-stats"] });
      queryClient.invalidateQueries({ queryKey: ["home-tasks"] });
    },
  });
};

// Soft delete a task
export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
        throw new Error("Task ID is required to delete task");
      }

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await db
        .from("tasks")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.id || null,
        })
        .eq("id", taskId);

      if (error) throw error;

      // Log activity
      if (profile) {
        await db.from("task_activity_logs").insert([{
          task_id: taskId,
          action_type: "deleted",
          performed_by: profile.id,
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-stats"] });
    },
  });
};

// Reassign a task
export const useReassignTask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      newAssigneeId,
      reason,
    }: {
      taskId: string;
      newAssigneeId: string;
      reason?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Get current task to find old assignee
      const { data: task } = await db
        .from("tasks")
        .select("assigned_to, title, reassignment_count")
        .eq("id", taskId)
        .single();

      if (!task || !profile) throw new Error("Task or profile not found");

      const { error } = await db
        .from("tasks")
        .update({
          assigned_to: newAssigneeId,
          reassigned_from: task.assigned_to,
          reassignment_reason: reason || null,
          reassignment_count: (task.reassignment_count || 0) + 1,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (error) throw error;

      // Log activity
      await db.from("task_activity_logs").insert([{
        task_id: taskId,
        action_type: "reassigned",
        performed_by: profile.id,
        old_value: { assigned_to: task.assigned_to } as unknown as import("@/types/db").Json,
        new_value: { assigned_to: newAssigneeId, reason } as unknown as import("@/types/db").Json,
      }]);

      // Notify new assignee
      const { data: assigneeProfile } = await db
        .from("profiles")
        .select("email, user_id")
        .eq("id", newAssigneeId)
        .maybeSingle();

      if (assigneeProfile?.user_id) {
        await db.rpc("create_notification", {
          _user_id: assigneeProfile.user_id,
          _type: "task_reassigned",
          _title: "Task Reassigned to You",
          _message: `You've been assigned: "${task.title}" by ${profile.full_name}`,
          _metadata: { task_id: taskId },
        });

        sendPushNotification(
          assigneeProfile.user_id,
          "Task Reassigned 🔄",
          `You've been assigned: "${task.title}"`,
          { url: "/tasks", tag: "task-reassigned" }
        ).catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-stats"] });
    },
  });
};

// Update a task
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      title,
      description,
      assignedTo,
      projectId,
      priority,
      dueDate,
      status,
      blockedReason,
      taskType,
    }: {
      taskId: string;
      title: string;
      description?: string;
      assignedTo?: string | null;
      projectId?: string | null;
      priority?: string;
      dueDate?: string | null;
      status?: string;
      blockedReason?: string;
      taskType?: string;
    }) => {
      if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
        throw new Error("Task ID is required to update task");
      }
      const updateData: Record<string, unknown> = {
        title,
        description: description || null,
        assigned_to: assignedTo || null,
        project_id: projectId || null,
        priority: priority || "medium",
        due_date: dueDate || null,
      };

      if (taskType) {
        updateData.task_type = taskType;
      }

      if (status) {
        updateData.status = status;
        if (status === "completed") {
          updateData.completed_at = new Date().toISOString();
        } else if (status !== "approved") {
          updateData.completed_at = null;
        }
        if (status === "blocked" && blockedReason) {
          updateData.blocked_reason = blockedReason;
        } else if (status !== "blocked") {
          updateData.blocked_reason = null;
        }
      }

      const { data, error } = await db
        .from("tasks")
        .update(updateData)
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-stats"] });
    },
  });
};
