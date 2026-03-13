import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle, XCircle, Clock, User, FileText, ExternalLink,
  Loader2, ClipboardList, CheckSquare, Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingContributions, useReviewContribution } from "@/hooks/useManagerReview";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { TaskManagement } from "@/components/manager/TaskManagement";
import { ProjectManagement } from "@/components/manager/ProjectManagement";


const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

type TabType = "contributions" | "tasks" | "projects";

const ManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>("contributions");
  const { data: contributions, isLoading } = usePendingContributions();
  const reviewMutation = useReviewContribution();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      await reviewMutation.mutateAsync({ contributionId: id, status, notes: reviewNotes });
      toast.success(`Contribution ${status}`);
      setReviewingId(null);
      setReviewNotes("");
    } catch { toast.error("Failed to review contribution"); }
  };

  const tabs = [
    { id: "contributions" as TabType, label: "Contributions", icon: CheckSquare },
    { id: "tasks" as TabType, label: "Tasks", icon: ClipboardList },
    { id: "projects" as TabType, label: "Projects", icon: Folder },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card hover:bg-muted border border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "contributions" && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : contributions && contributions.length > 0 ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
              {contributions.map((contribution) => (
                <motion.div key={contribution.id} variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{contribution.employee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(contribution.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs bg-pending/10 text-pending px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />Pending
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{contribution.title}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{contribution.description}</p>
                  {contribution.task_title && (
                    <div className="text-xs text-muted-foreground mb-3"><span className="font-medium">Task:</span> {contribution.task_title}</div>
                  )}
                  {contribution.evidence_url && (
                    <div className="mb-4">
                      {contribution.evidence_type?.startsWith("image") && contribution.evidence_url?.trim() ? (
                        <a href={contribution.evidence_url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={contribution.evidence_url.trim()} alt="Evidence" className="max-h-48 rounded-lg border border-border" />
                        </a>
                      ) : (
                        <a href={contribution.evidence_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <FileText className="w-4 h-4" />View Attached File<ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  {reviewingId === contribution.id ? (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add review notes (optional)" rows={2} className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                      <div className="flex gap-2">
                        <Button onClick={() => handleReview(contribution.id, "approved")} disabled={reviewMutation.isPending} className="flex-1 bg-success hover:bg-success/90"><CheckCircle className="w-4 h-4 mr-2" />Approve</Button>
                        <Button onClick={() => handleReview(contribution.id, "rejected")} disabled={reviewMutation.isPending} variant="destructive" className="flex-1"><XCircle className="w-4 h-4 mr-2" />Reject</Button>
                        <Button onClick={() => { setReviewingId(null); setReviewNotes(""); }} variant="outline">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-border">
                      <Button onClick={() => setReviewingId(contribution.id)} className="w-full" variant="outline">Review This Contribution</Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <h3 className="font-semibold text-lg">All caught up!</h3>
              <p className="text-muted-foreground mt-1">No pending contributions to review</p>
            </div>
          )}
        </>
      )}

      {activeTab === "tasks" && <TaskManagement />}

      {activeTab === "projects" && <ProjectManagement />}
    </>
  );
};

export default ManagerDashboard;
