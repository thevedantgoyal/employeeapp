import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface Skill {
  id: string;
  name: string;
  proficiency_level: number | null;
  goal_level: number | null;
  last_updated: string | null;
}

/** Parse profile other_social_links.skills (CSV) to array of names. */
function getSkillNamesFromProfile(profile: { other_social_links?: unknown } | null): string[] {
  if (!profile?.other_social_links || typeof profile.other_social_links !== "object") return [];
  const skillsStr = (profile.other_social_links as Record<string, string>).skills;
  if (!skillsStr || typeof skillsStr !== "string") return [];
  return skillsStr.split(",").map((s) => s.trim()).filter(Boolean);
}

export const useSkills = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["skills", user?.id],
    queryFn: async (): Promise<Skill[]> => {
      if (!user) return [];

      const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v != null ? [v] : []);

      // 1) Fetch from profile (source filled during Complete Profile)
      const { data: profile } = await db
        .from("profiles")
        .select("other_social_links")
        .eq("user_id", user.id)
        .single();

      const profileSkillNames = getSkillNamesFromProfile(profile as { other_social_links?: unknown } | null);

      // 2) Fetch from skills table (for proficiency/goal and skills added via Add button)
      const { data: tableRows, error } = await db
        .from("skills")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      type SkillRow = { id: string; name: string; proficiency_level?: number | null; goal_level?: number | null; last_updated?: string | null };
      const rows = asArray(tableRows) as SkillRow[];

      const byName = new Map<string, SkillRow>();
      for (const r of rows) byName.set(r.name.trim().toLowerCase(), r);

      // 3) Merge: start with profile names (Complete Profile), then add any from table not in profile
      const seen = new Set<string>();
      const result: Skill[] = [];
      for (const name of profileSkillNames) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const row = byName.get(key);
        result.push({
          id: row?.id ?? `profile-${result.length}-${name}`,
          name,
          proficiency_level: row?.proficiency_level ?? 50,
          goal_level: row?.goal_level ?? 100,
          last_updated: row?.last_updated ?? null,
        });
      }
      for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: row.id,
          name: row.name,
          proficiency_level: row.proficiency_level ?? 50,
          goal_level: row.goal_level ?? 100,
          last_updated: row.last_updated ?? null,
        });
      }
      result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return result;
    },
    enabled: !!user,
  });
};

export const useCreateSkill = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      proficiency_level,
      goal_level,
    }: {
      name: string;
      proficiency_level: number;
      goal_level: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Skill name is required");

      // 1) Add to profile other_social_links.skills (so it appears in profile skills)
      const { data: profile } = await db
        .from("profiles")
        .select("other_social_links")
        .eq("user_id", user.id)
        .single();

      const current = (profile as { other_social_links?: Record<string, string> } | null)?.other_social_links ?? {};
      const currentSkills = current.skills ?? "";
      const newSkillsStr = currentSkills ? `${currentSkills},${trimmedName}` : trimmedName;
      await db
        .from("profiles")
        .update({ other_social_links: { ...current, skills: newSkillsStr } })
        .eq("user_id", user.id);

      // 2) Insert into skills table (for proficiency/goal and consistency)
      const { data, error } = await db
        .from("skills")
        .insert({
          user_id: user.id,
          name: trimmedName,
          proficiency_level,
          goal_level,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
    },
  });
};

export const useUpdateSkill = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      proficiency_level,
      goal_level,
    }: {
      id: string;
      proficiency_level?: number;
      goal_level?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const isProfileId = String(id).startsWith("profile-");
      let rowId = id;
      let prof = proficiency_level;
      let goal = goal_level;
      if (prof != null && goal != null && prof > goal) goal = prof;
      if (isProfileId) {
        const name = id.replace(/^profile-\d+-/, "");
        const { data: inserted, error: insertErr } = await db
          .from("skills")
          .insert({
            user_id: user.id,
            name,
            proficiency_level: prof ?? 50,
            goal_level: goal ?? 100,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        rowId = (inserted as { id: string }).id;
      }
      const { data, error } = await db
        .from("skills")
        .update({
          ...(prof != null && { proficiency_level: prof }),
          ...(goal != null && { goal_level: goal }),
          last_updated: new Date().toISOString(),
        })
        .eq("id", rowId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
    },
  });
};

export const useDeleteSkill = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const isProfileId = String(id).startsWith("profile-");
      if (!isProfileId) {
        const { data: row } = await db.from("skills").select("name").eq("id", id).single();
        const skillName = (row as { name?: string } | null)?.name;
        if (skillName) {
          const { data: profile } = await db
            .from("profiles")
            .select("other_social_links")
            .eq("user_id", user.id)
            .single();
          const current = (profile as { other_social_links?: Record<string, string> } | null)?.other_social_links ?? {};
          const currentSkills = (current.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          const updated = currentSkills.filter((s) => s.toLowerCase() !== skillName.trim().toLowerCase());
          await db
            .from("profiles")
            .update({ other_social_links: { ...current, skills: updated.join(",") } })
            .eq("user_id", user.id);
        }
        const { error } = await db.from("skills").delete().eq("id", id);
        if (error) throw error;
      } else {
        const name = (id as string).replace(/^profile-\d+-/, "");
        const { data: profile } = await db
          .from("profiles")
          .select("other_social_links")
          .eq("user_id", user.id)
          .single();
        const current = (profile as { other_social_links?: Record<string, string> } | null)?.other_social_links ?? {};
        const currentSkills = (current.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const updated = currentSkills.filter((s) => s.toLowerCase() !== name.toLowerCase());
        await db
          .from("profiles")
          .update({ other_social_links: { ...current, skills: updated.join(",") } })
          .eq("user_id", user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["extended-profile"] });
    },
  });
};
