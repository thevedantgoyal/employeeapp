import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList, LayoutList, Columns3, GanttChart, Folder, ListTodo } from "lucide-react";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { TaskCard } from "@/components/cards/TaskCard";
import { useTasks, formatDueLabel } from "@/hooks/useTasks";
import { TaskDetailDrawer, TaskDetailData } from "@/components/tasks/TaskDetailDrawer";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanbanCardData } from "@/components/kanban/KanbanCard";
import { AdvancedFilters, TaskFilters, defaultFilters } from "@/components/tasks/AdvancedFilters";
import { GanttTimeline } from "@/components/tasks/GanttTimeline";
import { useUpdateTaskStatus } from "@/hooks/useTaskManagement";
import { useInsertActivityLog } from "@/hooks/useTaskActivityLogs";
import { useTaskDependencies } from "@/hooks/useTaskDependencies";
import { useUnseenTaskCounts, useMarkTasksSeen } from "@/hooks/useProjectManagement";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

type ViewMode = "list" | "kanban" | "gantt";
type TaskTypeFilter = "all" | "project" | "separate";

const TasksPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: tasks, isLoading, error } = useTasks();
  const [filters, setFilters] = useState<TaskFilters>(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      return { ...defaultFilters, status: statusParam };
    }
    return defaultFilters;
  });
  const [selectedTask, setSelectedTask] = useState<TaskDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [showBlockedPrompt, setShowBlockedPrompt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>("all");

  const updateStatus = useUpdateTaskStatus();
  const insertLog = useInsertActivityLog();
  const { data: unseenCounts } = useUnseenTaskCounts();
  const markSeen = useMarkTasksSeen();

  // Sync filters from URL when navigating from KPI cards (e.g. /tasks?status=pending)
  useEffect(() => {
    const statusParam = searchParams.get("status");
    setFilters((prev) => ({
      ...prev,
      ...(statusParam ? { status: statusParam } : {}),
    }));
  }, [searchParams]);

  // Mark all tasks as seen when user opens the Tasks page (click the tab)
  useEffect(() => {
    markSeen.mutate("project");
    markSeen.mutate("separate");
  }, []);

  // Mark tasks as seen when filter tab is selected (so badge on other tab clears when viewing that type)
  useEffect(() => {
    if (taskTypeFilter === "project") {
      markSeen.mutate("project");
    } else if (taskTypeFilter === "separate") {
      markSeen.mutate("separate");
    }
  }, [taskTypeFilter]);

  const completedTodayFromUrl = searchParams.get("completed_today") === "1";
  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const todayEnd = useMemo(() => endOfDay(new Date()).toISOString(), []);

  const filteredTasks = useMemo(() => {
    return tasks?.filter((t) => {
      // Task type filter
      if (taskTypeFilter === "project") {
        if (t.task_type !== "project_task" || !t.project_name || t.project_name === "No Project") return false;
      } else if (taskTypeFilter === "separate") {
        if (t.task_type === "project_task" && t.project_name && t.project_name !== "No Project") return false;
      }
      
      if (filters.status && t.status !== filters.status) return false;
      // "Done Today" from KPI: only tasks completed today
      if (completedTodayFromUrl && filters.status === "completed") {
        if (t.status !== "completed" || !t.completed_at) return false;
        if (t.completed_at < todayStart || t.completed_at > todayEnd) return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) return false;
      }
      if (filters.dateRange.from && t.due_date && t.due_date < filters.dateRange.from) return false;
      if (filters.dateRange.to && t.due_date && t.due_date > filters.dateRange.to) return false;
      return true;
    });
  }, [tasks, filters, taskTypeFilter, completedTodayFromUrl, todayStart, todayEnd]);

  const allTasksList = useMemo(() => (tasks || []).map(t => ({ id: t.id, title: t.title })), [tasks]);

  const handleTaskClick = (task: { id: string }) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleKanbanTaskClick = (task: KanbanCardData) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleGanttTaskClick = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleStatusUpdate = async (taskId: string, oldStatus: string | null, newStatus: string) => {
    if (newStatus === "blocked") {
      setShowBlockedPrompt(taskId);
      return;
    }
    try {
      await updateStatus.mutateAsync({ taskId, status: newStatus });
      await insertLog.mutateAsync({
        taskId,
        actionType: "status_changed",
        oldValue: { status: oldStatus },
        newValue: { status: newStatus },
      });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleBlockedSubmit = async (taskId: string) => {
    if (!blockedReason.trim()) {
      toast.error("Please provide a reason for blocking");
      return;
    }
    try {
      const task = tasks?.find((t) => t.id === taskId);
      await updateStatus.mutateAsync({ taskId, status: "blocked", blockedReason: blockedReason.trim() });
      await insertLog.mutateAsync({
        taskId,
        actionType: "status_changed",
        oldValue: { status: task?.status },
        newValue: { status: "blocked", blocked_reason: blockedReason.trim() },
      });
      toast.success("Task marked as blocked");
      setShowBlockedPrompt(null);
      setBlockedReason("");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const kanbanTasks: KanbanCardData[] = (filteredTasks || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project_name: t.project_name,
    reassignment_count: t.reassignment_count,
    blocked_reason: t.blocked_reason,
    task_type: t.task_type,
  }));

  const ganttTasks = (filteredTasks || []).map(t => ({
    id: t.id,
    title: t.title,
    start: t.due_date ? new Date(new Date(t.due_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    end: t.due_date,
    status: t.status,
    priority: t.priority,
    progress: t.status === "completed" || t.status === "approved" ? 100
      : t.status === "review" ? 75
      : t.status === "in_progress" ? 50
      : t.status === "blocked" ? 25
      : 0,
    dependencies: [],
  }));

  return (
    <>
      {/* Task Type Filter Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTaskTypeFilter("all")}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
            taskTypeFilter === "all"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-card hover:bg-muted border border-border"
          )}
        >
          <ListTodo className="w-4 h-4" />
          All Tasks
        </button>
        <button
          onClick={() => setTaskTypeFilter("project")}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 relative",
            taskTypeFilter === "project"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-card hover:bg-muted border border-border"
          )}
        >
          <Folder className="w-4 h-4" />
          Project Tasks
          {unseenCounts && unseenCounts.projectTaskCount > 0 && taskTypeFilter !== "project" && (
            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unseenCounts.projectTaskCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTaskTypeFilter("separate")}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 relative",
            taskTypeFilter === "separate"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-card hover:bg-muted border border-border"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Separate
          {unseenCounts && unseenCounts.separateTaskCount > 0 && taskTypeFilter !== "separate" && (
            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unseenCounts.separateTaskCount}
            </span>
          )}
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("gantt")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "gantt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GanttChart className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="mb-4">
        <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Blocked reason prompt */}
      {showBlockedPrompt && (
        <div className="mb-4 p-4 bg-card rounded-2xl border border-border/50 space-y-3">
          <p className="text-sm font-medium">Why is this task blocked?</p>
          <textarea
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            placeholder="Describe the blocker..."
            rows={2}
            className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleBlockedSubmit(showBlockedPrompt)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-destructive text-destructive-foreground"
            >
              Confirm Block
            </button>
            <button
              onClick={() => { setShowBlockedPrompt(null); setBlockedReason(""); }}
              className="px-4 py-2 rounded-full text-sm font-medium bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <ConnectPlusLoader variant="inline" message="Loading tasks..." />
      ) : error ? (
        <div className="text-center py-12 text-destructive">Failed to load tasks</div>
      ) : viewMode === "gantt" ? (
        <GanttTimeline tasks={ganttTasks} onTaskClick={handleGanttTaskClick} />
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tasks={kanbanTasks}
          onTaskClick={handleKanbanTaskClick}
          onStatusChange={handleStatusUpdate}
          visibleStatuses={["pending", "in_progress", "review", "blocked", "completed"]}
        />
      ) : filteredTasks && filteredTasks.length > 0 ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
          {filteredTasks.map((task, index) => (
            <motion.div key={task.id} variants={itemVariants} transition={{ delay: index * 0.05 }}>
              <TaskCard
                title={task.title}
                description={task.description || undefined}
                project={task.project_name || "No Project"}
                dueLabel={formatDueLabel(task.due_date)}
                priority={task.priority}
                status={task.status}
                reassignmentCount={task.reassignment_count}
                onClick={() => handleTaskClick(task)}
                onStatusChange={(newStatus) => handleStatusUpdate(task.id, task.status, newStatus)}
                isEmployee
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">No tasks found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filters.status || filters.priority || filters.search ? "Try different filters" : "Tasks will appear here when assigned by your manager"}
          </p>
        </div>
      )}

      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canUploadEvidence
        allTasks={allTasksList}
      />
    </>
  );
};

export default TasksPage;
