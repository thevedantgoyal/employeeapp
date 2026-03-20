import { LucideIcon, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryItemProps {
  icon: LucideIcon;
  title: string;
  status: "pending" | "approved" | "rejected";
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "Pending",
  },
  approved: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    label: "Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Rejected",
  },
};

export const HistoryItem = ({
  icon: Icon,
  title,
  status,
  className,
}: HistoryItemProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "bg-card rounded-xl p-3 shadow-soft border border-border/50 flex items-center gap-3",
        className
      )}
    >
      <div className={cn("p-2 rounded-lg", config.bg)}>
        <StatusIcon className={cn("w-4 h-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground text-sm line-clamp-1">
          {title}
        </h4>
      </div>
      <span
        className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          config.bg,
          config.color
        )}
      >
        {config.label}
      </span>
    </div>
  );
};
