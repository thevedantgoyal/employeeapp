import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

export interface Contribution {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created_at: string;
  task_id: string | null;
}

export interface ContributionGroup {
  label: string;
  items: Contribution[];
}

export const useContributions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contributions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await db
        .from("contributions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const groupContributionsByDate = (contributions: Contribution[]): ContributionGroup[] => {
  const groups: { [key: string]: Contribution[] } = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Earlier: [],
  };

  contributions.forEach((contribution) => {
    const date = new Date(contribution.created_at);
    
    if (isToday(date)) {
      groups.Today.push(contribution);
    } else if (isYesterday(date)) {
      groups.Yesterday.push(contribution);
    } else if (isThisWeek(date)) {
      groups["This Week"].push(contribution);
    } else if (isThisMonth(date)) {
      groups["This Month"].push(contribution);
    } else {
      groups.Earlier.push(contribution);
    }
  });

  // Filter out empty groups and return
  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
};

export const useCreateContribution = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      taskId,
      evidenceUrl,
      evidenceType,
    }: {
      title: string;
      description: string;
      taskId?: string;
      evidenceUrl?: string;
      evidenceType?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await db
        .from("contributions")
        .insert({
          user_id: user.id,
          title,
          description,
          task_id: taskId || null,
          evidence_url: evidenceUrl || null,
          evidence_type: evidenceType || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
    },
  });
};

export const useUserTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-tasks-for-contribution", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get the user's profile id
      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return [];

      // Fetch ongoing tasks (not completed) assigned to this user with project info
      const { data, error } = await db
        .from("tasks")
        .select(`
          id, 
          title,
          status,
          projects (
            name
          )
        `)
        .eq("assigned_to", profile.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        project_name: task.projects?.name || null,
      }));
    },
    enabled: !!user,
  });
};
