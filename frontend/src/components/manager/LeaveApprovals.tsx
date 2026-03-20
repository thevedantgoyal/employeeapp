import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, User, Calendar, FileText,
  ExternalLink, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePendingLeaves, useApproveLeave, useRejectLeave } from "@/hooks/useLeaveApprovals";
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

export const LeaveApprovals = () => {
  const { data: leaves, isLoading } = usePendingLeaves();
  const approveMutation = useApproveLeave();
  const rejectMutation = useRejectLeave();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ leaveId: id, comment: comment || undefined });
      toast.success("Leave approved successfully");
      setReviewingId(null);
      setComment("");
    } catch {
      toast.error("Failed to approve leave");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ leaveId: id, comment: comment || undefined });
      toast.success("Leave rejected");
      setReviewingId(null);
      setComment("");
    } catch {
      toast.error("Failed to reject leave");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leaves || leaves.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
        <h3 className="font-semibold text-lg">All caught up!</h3>
        <p className="text-muted-foreground mt-1">No pending leave requests to review</p>
      </div>
    );
  }

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {leaves.map((leave) => (
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
                  {formatDistanceToNow(new Date(leave.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs bg-pending/10 text-pending px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" />Pending
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
              <span className="font-medium text-foreground">({leave.days_count} day{leave.days_count !== 1 ? "s" : ""})</span>
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

          {/* Review section */}
          {reviewingId === leave.id ? (
            <div className="space-y-3 pt-3 border-t border-border">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment (optional)"
                rows={2}
              />
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
                  onClick={() => { setReviewingId(null); setComment(""); }}
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
        </motion.div>
      ))}
    </motion.div>
  );
};
