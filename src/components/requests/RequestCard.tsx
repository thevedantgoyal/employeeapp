import { format } from "date-fns";
import { FileText } from "lucide-react";
import { Request, REQUEST_TYPE_LABELS, REQUEST_PRIORITY_LABELS } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  forwarded: "bg-blue-500/10 text-blue-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
};

interface RequestCardProps {
  request: Request;
  onClick: () => void;
  showSubmitter?: boolean;
}

export function RequestCard({ request, onClick, showSubmitter }: RequestCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card rounded-2xl p-4 shadow-soft border border-border/50 hover:border-primary/30 hover:shadow-card transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showSubmitter && request.submitted_by_name && (
            <p className="text-xs text-muted-foreground mb-1">{request.submitted_by_name}</p>
          )}
          <h3 className="font-semibold truncate">{request.title}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {REQUEST_PRIORITY_LABELS[request.priority] ?? request.priority}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusStyles[request.status] ?? "bg-muted")}>
              {request.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {format(new Date(request.created_at), "MMM d, yyyy · h:mm a")}
          </p>
        </div>
        <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}
