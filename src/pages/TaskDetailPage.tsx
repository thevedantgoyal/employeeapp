import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Folder, User, Flag, RefreshCw, Clock, CheckCircle } from "lucide-react";
import { db } from "@/integrations/api/db";
import { useAuth } from "@/contexts/AuthContext";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskActivityTimeline } from "@/components/tasks/TaskActivityTimeline";
import { TaskEvidenceSection } from "@/components/tasks/TaskEvidenceSection";
import { TaskCommentsSection } from "@/components/tasks/TaskCommentsSection";
import { SubtasksSection } from "@/components/tasks/SubtasksSection";
import { DependenciesSection } from "@/components/tasks/DependenciesSection";
import { TagsSection } from "@/components/tasks/TagsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { useUpdateTaskStatus } from "@/hooks/useTaskManagement";
import { useInsertActivityLog } from "@/hooks/useTaskActivityLogs";
import { useMarkTaskSeenById } from "@/hooks/useProjectManagement";
import { toast } from "sonner";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { cn } from "@/lib/utils";

const priorityConfig: Record<string, { color: string; label: string }> = {
  urgent: { color: "bg-destructive/10 text-destructive", label: "Urgent" },
  high: { color: "bg-orange-500/10 text-orange-600", label: "High" },
  medium: { color: "bg-yellow-500/10 text-yellow-600", label: "Medium" },
  low: { color: "bg-green-500/10 text-green-600", label: "Low" },
};

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_name: string | null;
  assigned_to_name: string | null;
  reassignment_count: number;
  blocked_reason: string | null;
  task_type: string | null;
  created_at: string;
}

/** Raw task row from API (select with projects + assigned_to_profile) */
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  task_type: string | null;
  blocked_reason: string | null;
  reassignment_count: number;
  created_at: string;
  projects?: { name?: string } | null;
  assigned_to_profile?: { full_name?: string } | null;
}

const TaskDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const updateStatus = useUpdateTaskStatus();
  const insertLog = useInsertActivityLog();
  const markTaskSeen = useMarkTaskSeenById();

  useEffect(() => {
    const fetchTask = async () => {
      if (!user || !id) return;

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      const { data, error } = await db
        .from("tasks")
        .select(`
          id, title, description, status, priority, due_date,
          task_type, blocked_reason, reassignment_count, created_at,
          projects (name),
          assigned_to_profile:profiles!tasks_assigned_to_fkey (full_name)
        `)
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (error || !data) {
        toast.error("Task not found or access denied");
        navigate("/tasks", { replace: true });
        return;
      }

      const row = data as TaskRow;
      setTask({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        due_date: row.due_date,
        project_name: row.projects?.name ?? null,
        assigned_to_name: row.assigned_to_profile?.full_name ?? null,
        reassignment_count: row.reassignment_count ?? 0,
        blocked_reason: row.blocked_reason,
        task_type: row.task_type,
        created_at: row.created_at,
      });
      setLoading(false);
      markTaskSeen.mutate(id);
    };

    fetchTask();
  }, [user, id, navigate]);

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    try {
      await updateStatus.mutateAsync({ taskId: task.id, status: newStatus });
      await insertLog.mutateAsync({
        taskId: task.id,
        actionType: "status_changed",
        oldValue: { status: task.status },
        newValue: { status: newStatus },
      });
      setTask((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const isOverdue = task?.due_date && isPast(new Date(task.due_date)) && task.status !== "completed" && task.status !== "approved";
  const priorityInfo = task?.priority ? priorityConfig[task.priority] : null;
  const taskTypeLabel = task?.task_type === "project_task" && task?.project_name ? "Project Task" : "Separate Task";

  if (loading) {
    return <ConnectPlusLoader variant="inline" message="Loading task..." />;
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-soft space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TaskStatusBadge status={task.status} />
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {taskTypeLabel}
          </span>
          {priorityInfo && (
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1", priorityInfo.color)}>
              <Flag className="w-3 h-3" />
              {priorityInfo.label}
            </span>
          )}
          {(task.reassignment_count ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Reassigned {task.reassignment_count}x
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold">{task.title}</h1>

        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}

        <TagsSection taskId={task.id} canManage={false} />
      </div>

      {/* Meta info */}
      <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-soft space-y-3">
        {task.assigned_to_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned to:</span>
            <span className="font-medium">{task.assigned_to_name}</span>
          </div>
        )}
        {task.project_name && (
          <div className="flex items-center gap-2 text-sm">
            <Folder className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Project:</span>
            <span className="font-medium">{task.project_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Due:</span>
            <span className={cn("font-medium", isOverdue && "text-destructive")}>
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
              {isOverdue && " (Overdue)"}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Created:</span>
          <span className="font-medium">{format(new Date(task.created_at), "MMM d, yyyy")}</span>
        </div>

        {task.blocked_reason && task.status === "blocked" && (
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-sm font-medium text-destructive">Blocked Reason</p>
            <p className="text-sm text-muted-foreground mt-1">{task.blocked_reason}</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {task.status && !["completed", "approved"].includes(task.status) && (
        <div className="flex gap-2 flex-wrap">
          {task.status === "pending" && (
            <button onClick={() => handleStatusChange("in_progress")} className="text-sm px-4 py-2 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
              Start Working
            </button>
          )}
          {task.status === "in_progress" && (
            <>
              <button onClick={() => handleStatusChange("review")} className="text-sm px-4 py-2 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
                Submit for Review
              </button>
              <button onClick={() => handleStatusChange("blocked")} className="text-sm px-4 py-2 rounded-full bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-colors">
                Mark Blocked
              </button>
            </>
          )}
          {task.status === "blocked" && (
            <button onClick={() => handleStatusChange("in_progress")} className="text-sm px-4 py-2 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
              Resume
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1 text-xs">Subtasks</TabsTrigger>
          <TabsTrigger value="evidence" className="flex-1 text-xs">Evidence</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 text-xs">Activity</TabsTrigger>
          <TabsTrigger value="comments" className="flex-1 text-xs">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <SubtasksSection taskId={task.id} canCreate={false} />
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <DependenciesSection taskId={task.id} canManage={false} allTasks={[]} />
          </div>
        </TabsContent>
        <TabsContent value="evidence" className="mt-4">
          <TaskEvidenceSection taskId={task.id} canUpload />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <TaskActivityTimeline taskId={task.id} />
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <TaskCommentsSection taskId={task.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaskDetailPage;
