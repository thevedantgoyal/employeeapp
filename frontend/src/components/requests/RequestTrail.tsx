import { format } from "date-fns";
import { RequestTrailEntry } from "@/hooks/useRequests";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface RequestTrailProps {
  trail: RequestTrailEntry[] | null | undefined;
  submittedByUserId: string;
}

export function RequestTrail({ trail, submittedByUserId }: RequestTrailProps) {
  const { user } = useAuth();
  const entries = Array.isArray(trail) ? trail : [];

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm text-muted-foreground">Status Trail</h4>
      <div className="relative pl-4 border-l-2 border-border space-y-4">
        {entries.map((entry, i) => {
          const isYou = entry.action_by === user?.id || (entry.action === "submitted" && submittedByUserId === user?.id);
          return (
            <div key={entry.id} className="relative -left-4 pl-6">
              <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
              <p className="font-medium capitalize">{entry.action}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), "MMM d · h:mm a")}
                {" · "}
                {isYou ? "You" : (entry.action_by_name || "Unknown")}
              </p>
              {entry.note && (
                <p className={cn("text-sm mt-1 p-2 rounded-lg", entry.action === "rejected" ? "bg-red-500/10 text-red-700" : "bg-muted/50")}>
                  {entry.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
