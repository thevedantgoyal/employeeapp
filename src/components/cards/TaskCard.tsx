import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Calendar, Folder, Flag, RefreshCw, ChevronRight } from "lucide-react";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

interface TaskCardProps {
  title: string;
  description?: string;
  project: string;
  dueLabel: string;
  priority?: string | null;
  status?: string | null;
  reassignmentCount?: number;
  imageUrl?: string;
  className?: string;
  onClick?: () => void;
  onStatusChange?: (newStatus: string) => void;
  isEmployee?: boolean;
}

const priorityConfig = {
  urgent: { color: "bg-destructive/10 text-destructive", label: "Urgent" },
  high: { color: "bg-orange-500/10 text-orange-600", label: "High" },
  medium: { color: "bg-yellow-500/10 text-yellow-600", label: "Medium" },
  low: { color: "bg-green-500/10 text-green-600", label: "Low" },
};

const employeeTransitions: Record<string, { label: string; value: string }[]> = {
  pending: [{ label: "Start Working", value: "in_progress" }],
  in_progress: [
    { label: "Submit for Review", value: "review" },
    { label: "Mark Blocked", value: "blocked" },
  ],
  blocked: [{ label: "Resume", value: "in_progress" }],
  review: [],
  completed: [],
  approved: [],
};

export const TaskCard = ({
  title,
  description,
  project,
  dueLabel,
  priority,
  status,
  reassignmentCount,
  imageUrl,
  className,
  onClick,
  onStatusChange,
  isEmployee,
}: TaskCardProps) => {
  const priorityInfo = priority
    ? priorityConfig[priority as keyof typeof priorityConfig]
    : null;
  const isOverdue = dueLabel === "Overdue";
  const transitions = isEmployee ? employeeTransitions[status || "pending"] || [] : [];

  return (
    <motion.div
      className={cn(
        "bg-card rounded-2xl p-4 shadow-soft border border-border/50 cursor-pointer hover:shadow-card transition-shadow",
        isOverdue && status !== "completed" && status !== "approved" && "border-destructive/30",
        className
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
    >
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Header with status, priority and due date */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TaskStatusBadge status={status} />
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                isOverdue
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Calendar className="w-3 h-3" />
              {dueLabel}
            </span>
            {priorityInfo && (
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                  priorityInfo.color
                )}
              >
                <Flag className="w-3 h-3" />
                {priorityInfo.label}
              </span>
            )}
            {(reassignmentCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <RefreshCw className="w-3 h-3" />
                {reassignmentCount}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground line-clamp-2">{title}</h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}

          {/* Project */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Folder className="w-3.5 h-3.5" />
            <span>{project}</span>
          </div>

          {/* Quick status transitions for employees */}
          {isEmployee && transitions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {transitions.map((t) => (
                <button
                  key={t.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange?.(t.value);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  {t.label}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-accent flex-shrink-0">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};
