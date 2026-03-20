import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Calendar, Folder, Flag, RefreshCw, ChevronRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

interface TaskCardProps {
  title: string;
  description?: string;
  project: string;
  dueLabel: string;
  /** Raw due timestamp for deadline reminders */
  dueDate?: string | null;
  priority?: string | null;
  status?: string | null;
  reassignmentCount?: number;
  taskDate?: string | null;
  durationHours?: number | null;
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
  dueDate,
  priority,
  status,
  reassignmentCount,
  taskDate,
  durationHours,
  imageUrl,
  className,
  onClick,
  onStatusChange,
  isEmployee,
}: TaskCardProps) => {
  const priorityInfo = priority
    ? priorityConfig[priority as keyof typeof priorityConfig]
    : null;
  const isOverdue = dueLabel.includes("Overdue");
  const transitions = isEmployee ? employeeTransitions[status || "pending"] || [] : [];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const durationLabel = useMemo(() => {
    if (durationHours == null || durationHours <= 0) return null;
    const h = Math.floor(durationHours);
    const m = Math.round((durationHours - h) * 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }, [durationHours]);

  const deadlineHint = useMemo(() => {
    const raw = taskDate || dueDate;
    if (!raw || status === "completed" || status === "approved") return null;
    const end = new Date(raw);
    if (Number.isNaN(end.getTime())) return null;
    // compare calendar day
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    if (now > endDay) return null;
    const ms = endDay.getTime() - now.getTime();
    const hours = ms / (60 * 60 * 1000);
    if (hours > 48) return null;
    if (hours <= 0) return null;
    const h = Math.floor(ms / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return { type: "soon" as const, label: h > 0 ? `Due in ${h}h ${String(m).padStart(2, "0")}m` : `Due in ${m}m` };
  }, [taskDate, dueDate, status, now]);

  const displayDateStr = taskDate || dueDate;
  const formattedDate =
    displayDateStr && !Number.isNaN(new Date(displayDateStr).getTime())
      ? format(new Date(displayDateStr), "dd MMM yyyy")
      : null;

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

          <h3 className="font-semibold text-foreground line-clamp-2">{title}</h3>

          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Folder className="w-3.5 h-3.5" />
            <span>{project}</span>
          </div>

          {(formattedDate || durationLabel || deadlineHint) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {formattedDate && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              )}
              {durationLabel && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationLabel}
                </span>
              )}
              {deadlineHint && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {deadlineHint.label}
                </span>
              )}
            </div>
          )}

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
