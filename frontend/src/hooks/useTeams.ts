import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface Team {
  id: string;
  name: string;
  description: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    full_name: string;
    job_title: string | null;
  } | null;
  member_count?: number;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  user_id: string;
}

export const useTeams = () => {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // First get teams
      const { data: teams, error } = await db
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;

      // Get leads separately
      const leadIds = teams?.map(t => t.lead_id).filter(Boolean) || [];
      const leadsMap: Record<string, { id: string; full_name: string; job_title: string | null }> = {};
      
      if (leadIds.length > 0) {
        const { data: leads } = await db
          .from("profiles")
          .select("id, full_name, job_title")
          .in("id", leadIds);
        
        leads?.forEach(lead => {
          leadsMap[lead.id] = lead;
        });
      }

      // Get member counts
      const { data: profiles } = await db
        .from("profiles")
        .select("team_id");

      const memberCounts: Record<string, number> = {};
      profiles?.forEach((p) => {
        if (p.team_id) {
          memberCounts[p.team_id] = (memberCounts[p.team_id] || 0) + 1;
        }
      });

      return (teams || []).map((team) => ({
        ...team,
        lead: team.lead_id ? leadsMap[team.lead_id] || null : null,
        member_count: memberCounts[team.id] || 0,
      })) as Team[];
    },
  });
};

export const useTeamMembers = (teamId: string | null) => {
  return useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      if (!teamId) return [];

      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, email, job_title, department, user_id")
        .eq("team_id", teamId)
        .order("full_name");

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!teamId,
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; lead_id?: string }) => {
      const { data: team, error } = await db
        .from("teams")
        .insert({
          name: data.name,
          description: data.description || null,
          lead_id: data.lead_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string | null;
      lead_id?: string | null;
    }) => {
      const { error } = await db.from("teams").update(updates).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unassign all members from the team
      await db.from("profiles").update({ team_id: null }).eq("team_id", id);

      const { error } = await db.from("teams").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
};

export const useAssignToTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, teamId }: { profileId: string; teamId: string | null }) => {
      const { error } = await db
        .from("profiles")
        .update({ team_id: teamId })
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
};

export const useTeamStats = (teamId: string | null) => {
  return useQuery({
    queryKey: ["team-stats", teamId],
    queryFn: async () => {
      if (!teamId) return null;

      // Get team members
      const { data: members } = await db
        .from("profiles")
        .select("id, user_id")
        .eq("team_id", teamId);

      if (!members || members.length === 0) {
        return {
          memberCount: 0,
          totalContributions: 0,
          approvedContributions: 0,
          pendingContributions: 0,
          activeTasks: 0,
          completedTasks: 0,
        };
      }

      const memberIds = members.map((m) => m.id);
      const userIds = members.map((m) => m.user_id);

      // Get contributions for team members
      const { data: contributions } = await db
        .from("contributions")
        .select("status")
        .in("user_id", userIds);

      // Get tasks for team members
      const { data: tasks } = await db
        .from("tasks")
        .select("status")
        .in("assigned_to", memberIds);

      return {
        memberCount: members.length,
        totalContributions: contributions?.length || 0,
        approvedContributions: contributions?.filter((c) => c.status === "approved").length || 0,
        pendingContributions: contributions?.filter((c) => c.status === "pending").length || 0,
        activeTasks: tasks?.filter((t) => t.status !== "completed").length || 0,
        completedTasks: tasks?.filter((t) => t.status === "completed").length || 0,
      };
    },
    enabled: !!teamId,
  });
};
