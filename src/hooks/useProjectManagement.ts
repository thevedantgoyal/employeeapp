import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
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
}

export interface ProjectMember {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
}

// Fetch projects created by the logged-in manager
export const useManagerProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string } | null;
      if (!profileRow) return [];

      // Fetch projects created by this manager
      const { data: projects, error } = await db
        .from("projects")
        .select("id, name, description, project_type, due_date, status, created_at, created_by")
        .eq("created_by", profileRow.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const projectList = (projects as { id: string; name: string; description: string | null; project_type: string; due_date: string | null; status: string | null; created_at: string; created_by: string | null }[]) ?? [];
      const projectIds = projectList.map((p) => p.id);
      if (projectIds.length === 0) return [];

      const { data: members } = await db
        .from("project_members")
        .select("id, project_id, employee_id")
        .in("project_id", projectIds);

      const memberList = (members as { id: string; project_id: string; employee_id: string }[]) ?? [];
      const employeeIds = [...new Set(memberList.map((m) => m.employee_id))];
      let profileMap = new Map<string, { full_name: string; email: string }>();

      if (employeeIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name, email")
          .in("id", employeeIds);

        const profileList = (profiles as { id: string; full_name: string; email: string }[]) ?? [];
        profileMap = new Map(profileList.map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
      }

      return projectList.map((p) => ({
        ...p,
        members: memberList
          .filter((m) => m.project_id === p.id)
          .map((m) => ({
            id: m.id,
            employee_id: m.employee_id,
            full_name: profileMap.get(m.employee_id)?.full_name || "Unknown",
            email: profileMap.get(m.employee_id)?.email || "",
          })),
      })) as ProjectWithMembers[];
    },
    enabled: !!user,
  });
};

// Fetch projects where the employee is a member
export const useEmployeeProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string } | null;
      if (!profileRow) return [];

      const { data: memberships } = await db
        .from("project_members")
        .select("project_id")
        .eq("employee_id", profileRow.id);

      const membershipList = (memberships as { project_id: string }[]) ?? [];
      if (membershipList.length === 0) return [];

      const projectIds = membershipList.map((m) => m.project_id);

      const { data: projects, error } = await db
        .from("projects")
        .select("id, name, description, project_type, due_date, status, created_at, created_by")
        .in("id", projectIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: allMembers } = await db
        .from("project_members")
        .select("id, project_id, employee_id")
        .in("project_id", projectIds);

      const allMembersList = (allMembers as { id: string; project_id: string; employee_id: string }[]) ?? [];
      const employeeIds = [...new Set(allMembersList.map((m) => m.employee_id))];
      let profileMap = new Map<string, { full_name: string; email: string }>();

      if (employeeIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name, email")
          .in("id", employeeIds);

        const profileList = (profiles as { id: string; full_name: string; email: string }[]) ?? [];
        profileMap = new Map(profileList.map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
      }

      const projectList = (projects as { id: string; name: string; description: string | null; project_type: string; due_date: string | null; status: string | null; created_at: string; created_by: string | null }[]) ?? [];
      const { data: taskCounts } = await db
        .from("tasks")
        .select("project_id")
        .eq("assigned_to", profileRow.id)
        .eq("is_deleted", "false")
        .in("project_id", projectIds);

      const taskCountMap = new Map<string, number>();
      const taskCountList = (taskCounts as { project_id?: string }[]) ?? [];
      taskCountList.forEach((t) => {
        if (t.project_id) {
          taskCountMap.set(t.project_id, (taskCountMap.get(t.project_id) || 0) + 1);
        }
      });

      return projectList.map((p) => ({
        ...p,
        members: allMembersList
          .filter((m) => m.project_id === p.id)
          .map((m) => ({
            id: m.id,
            employee_id: m.employee_id,
            full_name: profileMap.get(m.employee_id)?.full_name || "Unknown",
            email: profileMap.get(m.employee_id)?.email || "",
          })),
        taskCount: taskCountMap.get(p.id) || 0,
      }));
    },
    enabled: !!user,
  });
};

// Fetch members of a specific project (for task assignment)
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
    }: {
      name: string;
      description?: string;
      projectType: string;
      dueDate: string;
      employeeIds: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string } | null;
      if (!profileRow) throw new Error("Profile not found");

      const { data: directReports } = await db
        .from("profiles")
        .select("id")
        .eq("manager_id", profileRow.id)
        .in("id", employeeIds);

      const directReportsList = (directReports as { id: string }[]) ?? [];
      if (directReportsList.length !== employeeIds.length) {
        throw new Error("You can only assign direct reporting employees to projects");
      }

      const { data: project, error: projectError } = await db
        .from("projects")
        .insert({
          name,
          description: description || null,
          project_type: projectType,
          due_date: dueDate,
          created_by: profileRow.id,
          status: "active",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const projectRow = project as { id: string };
      const memberInserts = employeeIds.map((empId) => ({
        project_id: projectRow.id,
        employee_id: empId,
      }));

      const { error: membersError } = await db
        .from("project_members")
        .insert(memberInserts);

      if (membersError) throw membersError;

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-projects"] });
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
