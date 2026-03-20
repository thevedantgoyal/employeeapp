import { Loader2 } from "lucide-react";
import { useTaskActivityLogs } from "@/hooks/useTaskActivityLogs";
import { formatDistanceToNow } from "date-fns";

const actionLabels: Record<string, string> = {
  created: "created the task",
  updated: "updated the task",
  status_changed: "changed status",
  reassigned: "reassigned the task",
  evidence_uploaded: "uploaded evidence",
  comment_added: "added a comment",
  deleted: "deleted the task",
  approved: "approved the task",
};

interface TaskActivityTimelineProps {
  taskId: string | null;
}

export const TaskActivityTimeline = ({ taskId }: TaskActivityTimelineProps) => {
  const { data: logs, isLoading } = useTaskActivityLogs(taskId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, idx) => (
        <div key={log.id} className="flex gap-3 py-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
            {idx < logs.length - 1 && (
              <div className="w-px flex-1 bg-border" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-2">
            <p className="text-sm">
              <span className="font-medium">{log.performer_name}</span>{" "}
              <span className="text-muted-foreground">
                {actionLabels[log.action_type] || log.action_type}
              </span>
            </p>

            {/* Show old -> new for status changes */}
            {log.action_type === "status_changed" && log.old_value && log.new_value && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {String(log.old_value.status || "").replace("_", " ")} →{" "}
                {String(log.new_value.status || "").replace("_", " ")}
              </p>
            )}

            {log.action_type === "reassigned" && log.new_value && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {log.new_value.reason ? `Reason: ${String(log.new_value.reason)}` : ""}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
