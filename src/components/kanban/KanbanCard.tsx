import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { Calendar, Flag, User, RefreshCw, GripVertical } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";

export interface KanbanCardData {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_name: string | null;
  assigned_to_name?: string | null;
  assigned_to_id?: string | null;
  reassignment_count?: number;
  blocked_reason?: string | null;
  task_type?: string | null;
}

interface KanbanCardProps {
  task: KanbanCardData;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  compact?: boolean;
}

const priorityColors: Record<string, string> = {
  urgent: "border-l-destructive",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

export const KanbanCard = ({ task, onClick, onDragStart, isDragging, compact }: KanbanCardProps) => {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed" && task.status !== "approved";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl p-3 border border-border/50 cursor-pointer hover:shadow-card transition-all group",
        "border-l-4",
        priorityColors[task.priority || "medium"] || "border-l-border",
        isDragging && "opacity-50 rotate-2 shadow-elevated",
        isOverdue && "ring-1 ring-destructive/30"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium line-clamp-2 leading-tight">{task.title}</h4>

          {!compact && task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {task.task_type && (
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                task.task_type === "separate_task" ? "bg-violet-500/10 text-violet-600" : "bg-sky-500/10 text-sky-600",
              )}>
                {task.task_type === "separate_task" ? "Ad-hoc" : "Project"}
              </span>
            )}
            {task.priority && (
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                task.priority === "urgent" && "bg-destructive/10 text-destructive",
                task.priority === "high" && "bg-orange-500/10 text-orange-600",
                task.priority === "medium" && "bg-yellow-500/10 text-yellow-600",
                task.priority === "low" && "bg-green-500/10 text-green-600",
              )}>
                <Flag className="w-2.5 h-2.5 inline mr-0.5" />
                {task.priority}
              </span>
            )}

            {task.due_date && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                isOverdue ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
              )}>
                <Calendar className="w-2.5 h-2.5" />
                {isOverdue ? "Overdue" : formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
              </span>
            )}

            {(task.reassignment_count ?? 0) > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <RefreshCw className="w-2.5 h-2.5" /> {task.reassignment_count}
              </span>
            )}
          </div>

          {task.assigned_to_name && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-2.5 h-2.5 text-primary" />
              </div>
              <span className="truncate">{task.assigned_to_name}</span>
            </div>
          )}

          {task.project_name && (
            <div className="text-[10px] text-muted-foreground mt-1 truncate">
              {task.project_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
