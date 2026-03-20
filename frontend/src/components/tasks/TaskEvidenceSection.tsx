import { useState } from "react";
import { FileText, Image, Link, File, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskEvidence } from "@/hooks/useTaskEvidence";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { FileUploader, type UploadedFileInfo } from "@/components/upload/FileUploader";

interface TaskEvidenceSectionProps {
  taskId: string | null;
  canUpload?: boolean;
}

const evidenceIcons: Record<string, React.ElementType> = {
  screenshot: Image,
  document: FileText,
  pr_link: Link,
  other: File,
};

export const TaskEvidenceSection = ({ taskId, canUpload = false }: TaskEvidenceSectionProps) => {
  const { data: evidence, isLoading } = useTaskEvidence(taskId);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [evidenceType, setEvidenceType] = useState("screenshot");
  const [comment, setComment] = useState("");

  const onUploadComplete = async (uploadedFiles: UploadedFileInfo[]) => {
    if (!taskId || !user) return;
    const { data: profile } = await db.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile) return;
    for (const f of uploadedFiles) {
      await db.from("task_evidence").insert({
        task_id: taskId,
        uploaded_by: profile.id,
        file_url: f.id,
        evidence_type: evidenceType,
        comment: comment.trim() || null,
      });
      await db.from("task_activity_logs").insert({
        task_id: taskId,
        action_type: "evidence_uploaded",
        performed_by: profile.id,
        new_value: { evidence_type: evidenceType, file_name: f.name },
      });
    }
    setComment("");
    queryClient.invalidateQueries({ queryKey: ["task-evidence"] });
    queryClient.invalidateQueries({ queryKey: ["task-activity-logs"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {canUpload && taskId && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex gap-2">
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              className="text-sm p-2 rounded-lg border border-border bg-background"
            >
              <option value="screenshot">Screenshot</option>
              <option value="document">Document</option>
              <option value="pr_link">PR Link</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note (optional)"
              className="flex-1 text-sm p-2 rounded-lg border border-border bg-background"
            />
          </div>
          <FileUploader
            multiple
            allowedTypes={["image/*", "application/pdf", ".doc", ".docx", "text/plain"]}
            maxFileSizeMB={10}
            bucket="evidence"
            label="Upload Evidence"
            onUploadComplete={onUploadComplete}
          />
        </div>
      )}

      {/* Evidence list */}
      {!evidence || evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No evidence uploaded yet
        </p>
      ) : (
        <div className="space-y-2">
          {evidence.map((item) => {
            const Icon = evidenceIcons[item.evidence_type] || File;
            return (
              <a
                key={item.id}
                href={item.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">
                    {item.evidence_type.replace("_", " ")}
                  </p>
                  {item.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.comment}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.uploader_name} •{" "}
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
