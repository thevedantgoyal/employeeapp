import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskEvidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  uploader_name?: string;
  file_url: string;
  evidence_type: string;
  comment: string | null;
  created_at: string;
}

export const useTaskEvidence = (taskId: string | null) => {
  return useQuery({
    queryKey: ["task-evidence", taskId],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await db
        .from("task_evidence")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const uploaderIds = [...new Set(data?.map((e) => e.uploaded_by))] as string[];
      let nameMap = new Map<string, string>();
      if (uploaderIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name")
          .in("id", uploaderIds);
        nameMap = new Map(profiles?.map((p) => [p.id, p.full_name]));
      }

      // Generate fresh signed URLs for each evidence item
      const evidenceWithUrls = await Promise.all(
        (data || []).map(async (e) => {
          let signedFileUrl = e.file_url;
          // If the file_url is a storage path (not a full URL), create a signed URL
          if (!e.file_url.startsWith("http")) {
            const { data: signedData } = await db.storage
              .from("evidence")
              .createSignedUrl(e.file_url, 3600);
            if (signedData) signedFileUrl = signedData.signedUrl;
          }
          return {
            ...e,
            file_url: signedFileUrl,
            uploader_name: nameMap.get(e.uploaded_by) || "Unknown",
          };
        })
      );

      return evidenceWithUrls as TaskEvidence[];
    },
    enabled: !!taskId,
  });
};

export const useUploadEvidence = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      file,
      evidenceType,
      comment,
    }: {
      taskId: string;
      file: File;
      evidenceType: string;
      comment?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      // Upload file to storage
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await db.storage
        .from("evidence")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path (not a signed URL) so we can generate fresh signed URLs at read time
      const { error } = await db.from("task_evidence").insert({
        task_id: taskId,
        uploaded_by: profile.id,
        file_url: filePath,
        evidence_type: evidenceType,
        comment: comment || null,
      });

      if (error) throw error;

      // Log activity
      await db.from("task_activity_logs").insert({
        task_id: taskId,
        action_type: "evidence_uploaded",
        performed_by: profile.id,
        new_value: { evidence_type: evidenceType, file_name: file.name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-evidence"] });
      queryClient.invalidateQueries({ queryKey: ["task-activity-logs"] });
    },
  });
};
