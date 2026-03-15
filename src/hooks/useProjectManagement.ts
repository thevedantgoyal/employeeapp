import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjectWithMembers {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  due_date: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  members: { id: string; employee_id: string; full_name: string; email: string }[];
  member_count?: number;
}

export interface ProjectMember {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
}

// Project list item from GET /api/projects (includes member_count and members_preview)
type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  due_date: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  member_count: number;
  manager_count: number;
  employee_count: number;
  members_preview: { id: string; employee_id: string; full_name: string; external_role: string }[];
};

// Fetch projects for current user (created by them OR they are a member). Uses GET /api/projects with member counts.
export const useManagerProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await api.get<ProjectListRow[]>("/projects");
      if (error) throw new Error(error.message);
      const list = data ?? [];
      return list.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        project_type: p.project_type,
        due_date: p.due_date,
        status: p.status,
        created_at: p.created_at,
        created_by: p.created_by,
        members: (p.members_preview ?? []).map((m) => ({
          id: m.id ?? m.employee_id,
          employee_id: m.employee_id,
          full_name: m.full_name || "Unknown",
          email: "",
        })),
        member_count: p.member_count ?? 0,
      })) as ProjectWithMembers[];
    },
    enabled: !!user,
  });
};

// Fetch projects where the employee is a member (same GET /api/projects; backend returns projects where created_by = me OR pm.employee_id = me).
export const useEmployeeProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await api.get<ProjectListRow[]>("/projects");
      if (error) throw new Error(error.message);
      const list = data ?? [];
      return list.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        project_type: p.project_type,
        due_date: p.due_date,
        status: p.status,
        created_at: p.created_at,
        created_by: p.created_by,
        members: (p.members_preview ?? []).map((m) => ({
          id: m.id ?? m.employee_id,
          employee_id: m.employee_id,
          full_name: m.full_name || "Unknown",
          email: "",
        })),
        member_count: p.member_count ?? 0,
        taskCount: 0,
      }));
    },
    enabled: !!user,
  });
};

/** Subadmin project creation: employees + managers (with manager_id). Excludes self, subadmins. */
export const useAssignableForProject = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignable-project", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await api.get<{ id: string; user_id: string; full_name: string; job_title: string | null; avatar_url: string | null; employee_code: string | null; department: string | null; external_role: string }[]>("/users/assignable/project");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
};

/** Project task assignees: only members of this project (excludes self). Use GET /projects/:projectId/members. */
export const useProjectMembersForTask = (projectId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-members-task", projectId, user?.id],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await api.get<{ id: string; user_id: string; full_name: string; job_title: string | null; avatar_url: string | null; employee_code: string | null; external_role: string }[]>(`/projects/${projectId}/members`);
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: "",
        job_title: p.job_title,
        avatar_url: p.avatar_url ?? undefined,
        employee_code: p.employee_code ?? undefined,
      }));
    },
    enabled: !!projectId && !!user,
  });
};

// Fetch members of a specific project (legacy / fallback - still used where API not yet used)
export const useProjectMembers = (projectId: string | null) => {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: members, error } = await db
        .from("project_members")
        .select("employee_id")
        .eq("project_id", projectId);

      if (error) throw error;

      const memberList = (members as { employee_id: string }[]) ?? [];
      const employeeIds = memberList.map((m) => m.employee_id);
      if (employeeIds.length === 0) return [];

      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name, email, job_title")
        .in("id", employeeIds);

      const profileList = (profiles as { id: string; full_name: string; email: string; job_title: string | null }[]) ?? [];
      return profileList.map((p) => ({
        id: p.id,
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        job_title: p.job_title,
      }));
    },
    enabled: !!projectId,
  });
};

/** Project details: full member list with role and added date. No self-exclude. */
export interface ProjectMemberDetail {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  external_role: string;
  external_sub_role: string | null;
  added_to_project_at: string;
}
export const useProjectMembersDetails = (projectId: string | null) => {
  return useQuery({
    queryKey: ["project-members-details", projectId],
    queryFn: async (): Promise<ProjectMemberDetail[]> => {
      if (!projectId) return [];
      const { data, error } = await api.get<ProjectMemberDetail[]>(`/projects/${projectId}/members/details`);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!projectId,
  });
};

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, profileId }: { projectId: string; profileId: string }) => {
      const { data, error } = await api.delete<{ removed: boolean }>(`/projects/${projectId}/members/${profileId}`);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-members-details", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-members-task", projectId] });
      queryClient.invalidateQueries({ queryKey: ["manager-projects"] });
    },
  });
};

// Create a project with members
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      projectType,
      dueDate,
      employeeIds,
      allowAnyAssignable,
    }: {
      name: string;
      description?: string;
      projectType: string;
      dueDate: string;
      employeeIds: string[];
      allowAnyAssignable?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string } | null;
      if (!profileRow) throw new Error("Profile not found");

      if (!allowAnyAssignable) {
        const { data: directReports } = await db
          .from("profiles")
          .select("id")
          .eq("manager_id", profileRow.id)
          .in("id", employeeIds);

        const directReportsList = (directReports as { id: string }[]) ?? [];
        if (directReportsList.length !== employeeIds.length) {
          throw new Error("You can only assign direct reporting employees to projects");
        }
      }

      const { data: project, error } = await api.post<{ id: string; name: string; description: string | null; project_type: string; due_date: string | null; status: string; created_at: string; created_by: string }>(
        "/projects",
        {
          name,
          description: description || null,
          project_type: projectType,
          due_date: dueDate,
          employeeIds,
        }
      );
      if (error) throw new Error(error.message);
      if (!project) throw new Error("Failed to create project");
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-projects"] });
      queryClient.invalidateQueries({ queryKey: ["employee-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

// Get unseen task counts by type (same as To-Do list: assigned_to = me; backend excludes created-by-me for managers)
export const useUnseenTaskCounts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unseen-task-counts", user?.id],
    queryFn: async () => {
      if (!user) return { projectTaskCount: 0, separateTaskCount: 0 };

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return { projectTaskCount: 0, separateTaskCount: 0 };

      const profileId = (profile as { id?: string }).id;
      if (!profileId) return { projectTaskCount: 0, separateTaskCount: 0 };
      // Use same filter as To-Do list: assigned_to = me. Backend excludes created-by-me for managers.
      const query = db
        .from("tasks")
        .select("id, task_type, project_id")
        .eq("is_deleted", false)
        .eq("is_seen", false)
        .neq("status", "approved")
        .eq("assigned_to", profileId);
      const { data: unseenTasks } = await query;

      let projectTaskCount = 0;
      let separateTaskCount = 0;
      const list: { task_type?: string; project_id?: string | null }[] = Array.isArray(unseenTasks) ? unseenTasks : [];
      for (const t of list) {
        if (t.task_type === "project_task" && t.project_id) {
          projectTaskCount++;
        } else {
          separateTaskCount++;
        }
      }

      return { projectTaskCount, separateTaskCount };
    },
    enabled: !!user,
  });
};

// Mark tasks as seen (all unseen tasks for the current user)
export const useMarkTasksSeen = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (_taskType?: "project" | "separate") => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string } | null;
      if (!profileRow) throw new Error("Profile not found");

      const { error } = await db
        .from("tasks")
        .update({ is_seen: true })
        .eq("assigned_to", profileRow.id)
        .eq("is_deleted", "false")
        .eq("is_seen", "false");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unseen-task-counts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};

// Mark a single task as seen (e.g. when user opens task detail)
export const useMarkTaskSeenById = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await db
        .from("tasks")
        .update({ is_seen: true })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unseen-task-counts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
