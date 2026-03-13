import { cn } from "@/lib/utils";
import {
  Clock,
  PlayCircle,
  Search,
  Ban,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-primary/10 text-primary",
    icon: PlayCircle,
  },
  review: {
    label: "In Review",
    className: "bg-yellow-500/10 text-yellow-600",
    icon: Search,
  },
  blocked: {
    label: "Blocked",
    className: "bg-destructive/10 text-destructive",
    icon: Ban,
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/10 text-green-600",
    icon: CheckCircle,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/10 text-emerald-700",
    icon: ShieldCheck,
  },
};

interface TaskStatusBadgeProps {
  status: string | null;
  className?: string;
  showIcon?: boolean;
}

export const TaskStatusBadge = ({ status, className, showIcon = true }: TaskStatusBadgeProps) => {
  const config = statusConfig[status || "pending"] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

export { statusConfig };
