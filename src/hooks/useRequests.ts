import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export type RequestStatus = "pending" | "forwarded" | "approved" | "rejected" | "cancelled";
export type RequestType = "resource" | "task_deadline" | "task_reassignment" | "general";
export type RequestPriority = "low" | "normal" | "high" | "urgent";

export interface RequestTrailEntry {
  id: string;
  action: string;
  action_by: string;
  action_by_name: string | null;
  note: string | null;
  created_at: string;
}

export interface Request {
  id: string;
  title: string;
  description: string | null;
  request_type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  submitted_by: string;
  submitted_to: string;
  current_handler: string;
  forwarded_to: string | null;
  forwarded_by?: string | null;
  forward_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  actioned_at: string | null;
  submitted_by_name?: string;
  trail?: RequestTrailEntry[];
}

/** Current user has no manager (top-level). Hide New Request tab and Forward button. */
export function useIsTopLevel() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile-manager", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await db.from("profiles").select("id, manager_id").eq("user_id", user.id).maybeSingle();
      return data as { id: string; manager_id: string | null } | null;
    },
    enabled: !!user,
  });
  return { isTopLevel: !profile?.manager_id, isLoading: !profile && !!user };
}

export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["requests-my", user?.id],
    queryFn: async () => {
      const res = await api.get<Request[]>("/requests/my");
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: !!user,
  });
}

export function useTeamRequests(statusFilter?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["requests-team", user?.id, statusFilter],
    queryFn: async () => {
      const params = statusFilter ? { status: statusFilter } : undefined;
      const res = await api.get<Request[]>("/requests/team", params as Record<string, string>);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: !!user,
  });
}

export function useRequestById(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get<Request>(`/requests/${id}`);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? null;
    },
    enabled: !!user && !!id,
  });
}

export function usePendingRequestsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["requests-pending-count", user?.id],
    queryFn: async () => {
      const res = await api.get<number>("/requests/pending-count");
      if (res.error) throw new Error(res.error.message);
      return res.data ?? 0;
    },
    enabled: !!user,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (body: { title: string; description?: string; request_type: string; priority: string }) => {
      const res = await api.post<Request>("/requests", body);
      if (res.error) throw new Error(res.error.message);
      if (!res.data) throw new Error("Failed to create request");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
      queryClient.invalidateQueries({ queryKey: ["requests-pending-count"] });
    },
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.patch<Request>(`/requests/${requestId}/approve`, {});
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
      queryClient.invalidateQueries({ queryKey: ["requests-pending-count"] });
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await api.patch<Request>(`/requests/${requestId}/reject`, { reason });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
      queryClient.invalidateQueries({ queryKey: ["requests-pending-count"] });
    },
  });
}

export function useForwardRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ requestId, note }: { requestId: string; note: string }) => {
      const res = await api.patch<Request>(`/requests/${requestId}/forward`, { note });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
      queryClient.invalidateQueries({ queryKey: ["requests-pending-count"] });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.patch<Request>(`/requests/${requestId}/cancel`, {});
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
      queryClient.invalidateQueries({ queryKey: ["requests-pending-count"] });
    },
  });
}

export function useEditRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      requestId,
      title,
      description,
      request_type,
      priority,
    }: {
      requestId: string;
      title?: string;
      description?: string;
      request_type?: string;
      priority?: string;
    }) => {
      const res = await api.patch<Request>(`/requests/${requestId}/edit`, {
        title,
        description,
        request_type,
        priority,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.id) queryClient.invalidateQueries({ queryKey: ["request", data.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-my", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["requests-team"] });
    },
  });
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  resource: "Resource / Equipment",
  task_deadline: "Task — Deadline Extension",
  task_reassignment: "Task — Reassignment",
  general: "General / Custom",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
