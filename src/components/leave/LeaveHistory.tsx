import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, XCircle, Clock, MessageSquare, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LeaveRequest } from "@/hooks/useLeaveManagement";

const statusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Pending",
  },
  approved: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    label: "Approved",
  },
  rejected: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Rejected",
  },
};

interface Props {
  requests: LeaveRequest[];
}

export const LeaveHistory = ({ requests }: Props) => {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold">No leave records</h3>
        <p className="text-sm text-muted-foreground mt-1">Your leave requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Leave Requests</h2>
      {requests.map((req, i) => {
        const status = statusConfig[req.status];
        return (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Collapsible>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{req.leaveType}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(req.fromDate), "dd MMM")} – {format(new Date(req.toDate), "dd MMM yyyy")}
                      </p>
                    </div>
                    <Badge className={`${status.className} gap-1 text-xs border-0`}>
                      {status.icon}
                      {status.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{req.daysCount} day(s){req.halfDay ? " (half-day)" : ""}</span>
                    <span>Applied: {format(new Date(req.appliedOn), "dd MMM yyyy")}</span>
                  </div>

                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                    <ChevronDown className="w-3 h-3" /> Details
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3 space-y-2 border-t border-border pt-3">
                    <div className="text-xs space-y-1.5">
                      <div>
                        <span className="text-muted-foreground">Reason: </span>
                        <span>{req.reason}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Approval Stage: </span>
                        <span className="font-medium">{req.approvalStage}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Approver: </span>
                        <span>{req.approverName}</span>
                      </div>
                      {req.approverComment && (
                        <div className="flex items-start gap-1.5 bg-muted/50 rounded-lg p-2 mt-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="italic">{req.approverComment}</span>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          </motion.div>
        );
      })}
    </div>
  );
};
