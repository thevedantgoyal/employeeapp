import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PerformanceData {
  userId: string;
  fullName: string;
  overallScore: number;
  attendanceScore: number;
  taskCompletionScore: number;
  overduePenalty: number;
  collaborationScore: number;
  skillsScore: number;
  calculatedAt: string;
}

export const usePerformance = (mode: "me" | "team" = "me") => {
  const { user } = useAuth();

  return useQuery<PerformanceData | PerformanceData[]>({
    queryKey: ["performance", user?.id, mode],
    queryFn: async () => {
      const { data, error } = await api.get<PerformanceData | PerformanceData[]>(`/performance?mode=${mode}`);
      if (error) throw new Error(error.message || "Failed to fetch performance");
      if (data == null) throw new Error("No performance data");
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};
