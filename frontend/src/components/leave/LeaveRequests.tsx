import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, Calendar, FileText,
  ExternalLink, Loader2, AlertCircle, ChevronDown, ChevronUp,
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
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
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

function getInitials(name: string): string {
  const n = String(name ?? "").trim();
  if (!n || n.toLowerCase() === "unknown") return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase().slice(0, 2);
}

export const LeaveRequests = () => {
  const { user: currentUser } = useAuth();
  const { roles } = useUserRoles();
  const userType = (currentUser as { userType?: string } | null)?.userType;
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
      setRejectError("Please add a reason for rejection");
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

  const isMutationPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {requests.map((leave: LeaveRequest, index: number) => {
        const config = statusConfig[leave.status] || statusConfig.pending;
        const StatusIcon = config.icon;

        const u = currentUser as { external_role?: string; role?: string } | null;
        const canApprove = (
          u?.external_role === "admin" ||
          u?.external_role === "manager" ||
          u?.external_role === "subadmin" ||
          u?.role === "admin" ||
          u?.role === "manager" ||
          userType === "MANAGER" ||
          userType === "SENIOR_MANAGER" ||
          roles.includes("admin") ||
          roles.includes("manager") ||
          roles.includes("hr")
        );
        const isLeavePending = String(leave?.status ?? "").toLowerCase() === "pending";
        const showActions = canApprove && isLeavePending;
        const isExpanded = reviewingId === leave.id;

        if (index === 0) {
          console.log("[LeaveCard] request.id:", leave?.id);
          console.log("[LeaveCard] showActions:", showActions);
        }

        return (
          <motion.div
            key={leave.id}
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {leave.employee_avatar_url?.trim() ? (
                    <img
                      src={leave.employee_avatar_url.trim()}
                      alt={leave.employee_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-primary">
                      {getInitials(leave.employee_name)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{leave.employee_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    Applied {formatDistanceToNow(new Date(leave.created_at), { addSuffix: true })}
                  </p>
                  {(leave.employee_job_title || leave.employee_code) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[leave.employee_job_title, leave.employee_code].filter(Boolean).join(" · ")}
                    </p>
                  )}
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

            {/* Action section - collapsed/expanded toggle for admin/manager when leave is pending */}
            {showActions && (
              <div className="mt-3 border-t border-border pt-0">
                <button
                  type="button"
                  onClick={() => setReviewingId(isExpanded ? null : leave.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-primary font-medium text-sm hover:bg-muted/50 rounded-b-2xl transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" /> Hide Actions
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" /> Review Leave Request
                    </>
                  )}
                </button>
                {isExpanded && (
                  <div className="space-y-3 pt-3 pb-1">
                    <Textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        if (rejectError) setRejectError("");
                      }}
                      placeholder="Add a comment (required for rejection)"
                      rows={2}
                      className="resize-none"
                    />
                    {rejectError && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />{rejectError}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        onClick={() => leave.id && handleApprove(leave.id)}
                        disabled={isMutationPending}
                        className="flex-1 min-w-[100px] bg-success hover:bg-success/90 text-success-foreground"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Approve
                      </Button>
                      <Button
                        type="button"
                        onClick={() => leave.id && handleReject(leave.id)}
                        disabled={isMutationPending}
                        variant="destructive"
                        className="flex-1 min-w-[100px]"
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setReviewingId(null);
                          setComment("");
                          setRejectError("");
                        }}
                        disabled={isMutationPending}
                        variant="outline"
                        className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
};
