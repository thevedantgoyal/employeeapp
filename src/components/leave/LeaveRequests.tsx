import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, User, Calendar, FileText,
  ExternalLink, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  type LeaveRequest,
} from "@/hooks/useLeaveRequests";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { toast } from "sonner";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-pending/10 text-pending", icon: Clock },
  approved: { label: "Approved", className: "bg-success/10 text-success", icon: CheckCircle },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

export const LeaveRequests = () => {
  const { data: requests, isLoading } = useLeaveRequests();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rejectError, setRejectError] = useState("");

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ leaveId: id, comment: comment || undefined });
      toast.success("Leave approved successfully");
      setReviewingId(null);
      setComment("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve leave");
    }
  };

  const handleReject = async (id: string) => {
    if (!comment.trim()) {
      setRejectError("Rejection reason is mandatory");
      return;
    }
    setRejectError("");
    try {
      await rejectMutation.mutateAsync({ leaveId: id, comment });
      toast.success("Leave rejected");
      setReviewingId(null);
      setComment("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reject leave");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
        <h3 className="font-semibold text-lg">No leave requests</h3>
        <p className="text-muted-foreground mt-1">There are no leave requests to display</p>
      </div>
    );
  }

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {requests.map((leave: LeaveRequest) => {
        const config = statusConfig[leave.status] || statusConfig.pending;
        const StatusIcon = config.icon;

        return (
          <motion.div
            key={leave.id}
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{leave.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Applied {formatDistanceToNow(new Date(leave.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.className}`}>
                <StatusIcon className="w-3 h-3" />{config.label}
              </span>
            </div>

            {/* Leave details */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{leave.leave_type}</Badge>
                {leave.half_day && <Badge variant="outline">Half-day</Badge>}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(parseISO(leave.from_date), "dd MMM yyyy")}
                  {leave.from_date !== leave.to_date && ` — ${format(parseISO(leave.to_date), "dd MMM yyyy")}`}
                </span>
                <span className="font-medium text-foreground">
                  ({leave.days_count} day{leave.days_count !== 1 ? "s" : ""})
                </span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 mb-3">
              <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
              <p className="text-sm">{leave.reason}</p>
            </div>

            {leave.attachment_url && (
              <a
                href={leave.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline mb-3"
              >
                <FileText className="w-4 h-4" />View Attachment
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Approver comment for non-pending */}
            {leave.status !== "pending" && leave.approver_comment && (
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  {leave.status === "rejected" ? "Rejection Reason" : "Comment"}
                </p>
                <p className="text-sm">{leave.approver_comment}</p>
              </div>
            )}

            {/* Action section - only for actionable pending leaves */}
            {leave.can_action && leave.status === "pending" && (
              <>
                {reviewingId === leave.id ? (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <Textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        if (rejectError) setRejectError("");
                      }}
                      placeholder="Add a comment (required for rejection)"
                      rows={2}
                    />
                    {rejectError && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{rejectError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(leave.id)}
                        disabled={isPending}
                        className="flex-1 bg-success hover:bg-success/90"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(leave.id)}
                        disabled={isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />Reject
                      </Button>
                      <Button
                        onClick={() => {
                          setReviewingId(null);
                          setComment("");
                          setRejectError("");
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-border">
                    <Button
                      onClick={() => setReviewingId(leave.id)}
                      className="w-full"
                      variant="outline"
                    >
                      Review Leave Request
                    </Button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
};
