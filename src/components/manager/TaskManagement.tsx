import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Calendar,
  User,
  Folder,
  Flag,
  Loader2,
  Clock,
  Trash2,
  ChevronDown,
  Edit,
  RefreshCw,
  ShieldCheck,
  LayoutList,
  Columns3,
  LayoutGrid,
  BarChart3,
  GanttChart,
  Briefcase,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useTeamMembers,
  useAssignableUsers,
  useProjects,
  useManagedTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useDeleteTask,
  useUpdateTask,
  useReassignTask,
  ManagedTask,
  type AssignableUser,
} from "@/hooks/useTaskManagement";
import { useInsertActivityLog } from "@/hooks/useTaskActivityLogs";
import { useTaskTagAssignmentsForTaskIds } from "@/hooks/useTaskTags";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectMembersForTask, useManagerProjects } from "@/hooks/useProjectManagement";
import { useAssignableAll } from "@/hooks/useTaskManagement";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskDetailDrawer, TaskDetailData } from "@/components/tasks/TaskDetailDrawer";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanbanSwimLaneBoard } from "@/components/kanban/KanbanSwimLaneBoard";
import { KanbanCardData } from "@/components/kanban/KanbanCard";
import { ProjectDashboard } from "@/components/kanban/ProjectDashboard";
import { AdvancedFilters, TaskFilters, defaultFilters } from "@/components/tasks/AdvancedFilters";
import { GanttTimeline } from "@/components/tasks/GanttTimeline";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EditTaskModal } from "./EditTaskModal";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const priorityColors = {
  low: "bg-green-500/10 text-green-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-orange-500/10 text-orange-600",
  urgent: "bg-destructive/10 text-destructive",
};

type ViewMode = "list" | "kanban" | "swimlane" | "dashboard" | "gantt";

export const TaskManagement = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [editingTask, setEditingTask] = useState<ManagedTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [swimLaneGroupBy, setSwimLaneGroupBy] = useState<"assignee" | "project">("assignee");
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [taskType, setTaskType] = useState<"project_task" | "separate_task">("project_task");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [assignModeDialogOpen, setAssignModeDialogOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"individual" | "shared">("individual");
  const [pendingCreatePayload, setPendingCreatePayload] = useState<{
    title: string;
    description?: string;
    assignedTo: string[];
    projectId?: string;
    priority: string;
    dueDate: string;
    taskType: "project_task" | "separate_task";
  } | null>(null);

  const { user } = useAuth();
  const isSubadmin = (user as { userType?: string; external_role?: string } | null)?.userType === "SENIOR_MANAGER"
    || (user as { external_role?: string } | null)?.external_role === "subadmin";
  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();
  const { data: assignableUsers = [], isLoading: assignableLoading } = useAssignableUsers();
  const { data: assignableAll = [], isLoading: assignableAllLoading } = useAssignableAll();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: managerProjects = [] } = useManagerProjects();
  const { data: projectMembersForTask = [] } = useProjectMembersForTask(taskType === "project_task" ? projectId : null);
  const { data: tasks = [], isLoading: tasksLoading } = useManagedTasks();
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { data: taskTagMap } = useTaskTagAssignmentsForTaskIds(taskIds);

  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const reassignTask = useReassignTask();
  const insertLog = useInsertActivityLog();

  const allTasksList = useMemo(() => tasks.map(t => ({ id: t.id, title: t.title })), [tasks]);

  const assignees = useMemo(() => teamMembers.map(m => ({ id: m.id, name: m.full_name })), [teamMembers]);

  // Project task: only project members (from API, excludes self). Standalone: subadmin → assignable/all, manager → assignable (direct reports + peer managers).
  const availableEmployees = useMemo(() => {
    if (taskType === "project_task" && projectId) return projectMembersForTask;
    if (taskType === "separate_task") {
      return (isSubadmin ? assignableAll : assignableUsers) as { id: string; full_name: string; job_title?: string | null; employee_code?: string | null; avatar_url?: string | null; external_role?: string; external_sub_role?: string | null }[];
    }
    return teamMembers;
  }, [taskType, projectId, projectMembersForTask, isSubadmin, assignableAll, assignableUsers, teamMembers]);

  const assignableGrouped = useMemo(() => {
    if (taskType !== "separate_task") return { seniorManagers: [] as (AssignableUser & { external_sub_role?: string | null })[], managers: [] as AssignableUser[], employees: [] as AssignableUser[] };
    if (isSubadmin && assignableAll.length) {
      const seniorManagers = assignableAll.filter((u) => (u.external_role || "").toLowerCase() === "subadmin" || (u.external_sub_role != null && String(u.external_sub_role).trim() !== ""));
      const managers = assignableAll.filter((u) => (u.external_role || "").toLowerCase() === "manager");
      const employees = assignableAll.filter((u) => (u.external_role || "").toLowerCase() !== "manager" && (u.external_role || "").toLowerCase() !== "subadmin" && !(u.external_sub_role != null && String(u.external_sub_role).trim() !== ""));
      return { seniorManagers, managers, employees };
    }
    if (assignableUsers.length) {
      const managers = assignableUsers.filter((u) => u.external_role === "manager");
      const employees = assignableUsers.filter((u) => u.external_role === "employee");
      return { seniorManagers: [] as AssignableUser[], managers, employees };
    }
    return { seniorManagers: [] as AssignableUser[], managers: [] as AssignableUser[], employees: [] as AssignableUser[] };
  }, [taskType, isSubadmin, assignableAll, assignableUsers]);

  const selectedProjectName = useMemo(() => {
    if (taskType !== "project_task" || !projectId) return null;
    return managerProjects.find((p) => p.id === projectId)?.name ?? projects.find((p) => p.id === projectId)?.name ?? null;
  }, [taskType, projectId, managerProjects, projects]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssignedToIds([]);
    setProjectId("");
    setPriority("medium");
    setDueDate("");
    setTaskType("project_task");
    setAssigneeSearch("");
    setShowCreateForm(false);
  };

  const filteredEmployees = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter((m) => m.full_name.toLowerCase().includes(q));
  }, [availableEmployees, assigneeSearch]);

  const filteredAssignableGrouped = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return assignableGrouped;
    return {
      seniorManagers: assignableGrouped.seniorManagers.filter((m) => m.full_name.toLowerCase().includes(q)),
      managers: assignableGrouped.managers.filter((m) => m.full_name.toLowerCase().includes(q)),
      employees: assignableGrouped.employees.filter((m) => m.full_name.toLowerCase().includes(q)),
    };
  }, [assignableGrouped, assigneeSearch]);

  const membersLoadingResolved = taskType === "separate_task"
    ? (isSubadmin ? assignableAllLoading : assignableLoading)
    : taskType === "project_task" && projectId
      ? false
      : membersLoading;

  const runCreateTask = async (payload: {
    title: string;
    description?: string;
    assignedTo: string[];
    projectId?: string;
    priority: string;
    dueDate: string;
    taskType: "project_task" | "separate_task";
    assignMode?: "individual" | "shared";
  }) => {
    const result = await createTask.mutateAsync(payload);
    const createdTasks = Array.isArray(result) ? result : result ? [result] : [];
    for (const task of createdTasks) {
      if (task?.id) {
        insertLog.mutateAsync({
          taskId: task.id,
          actionType: "created",
          newValue: { title: payload.title, priority: payload.priority, status: "pending", task_type: payload.taskType },
        }).catch(console.error);
      }
    }
    if (createdTasks.length > 1) {
      toast.success(`${createdTasks.length} tasks created successfully`);
    } else {
      toast.success("Task created successfully");
    }
    resetForm();
    setPendingCreatePayload(null);
    setAssignModeDialogOpen(false);
  };

  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (taskType === "project_task" && !projectId) {
      toast.error("Please select a project for project tasks");
      return;
    }
    if (assignedToIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: assignedToIds,
      projectId: taskType === "project_task" ? (projectId || undefined) : undefined,
      priority,
      dueDate: dueDate || undefined,
      taskType,
    };
    if (taskType === "separate_task" && assignedToIds.length > 1) {
      setPendingCreatePayload(payload);
      setAssignModeDialogOpen(true);
      return;
    }
    try {
      await runCreateTask(payload);
    } catch {
      toast.error("Failed to create task");
    }
  };

  const handleAssignModeConfirm = () => {
    if (!pendingCreatePayload) return;
    runCreateTask({ ...pendingCreatePayload, assignMode }).catch(() => toast.error("Failed to create task"));
  };

  const handleStatusChange = async (taskId: string, oldStatus: string | null, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ taskId, status: newStatus });
      await insertLog.mutateAsync({
        taskId,
        actionType: "status_changed",
        oldValue: { status: oldStatus },
        newValue: { status: newStatus },
      });
      toast.success(`Task marked as ${newStatus.replace("_", " ")}`);
    } catch (error) {
      toast.error("Failed to update task status");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to archive this task?")) return;
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success("Task archived");
    } catch (error) {
      toast.error("Failed to archive task");
    }
  };

  const handleReassign = async () => {
    if (!reassignTaskId || !reassignTo) return;
    try {
      await reassignTask.mutateAsync({
        taskId: reassignTaskId,
        newAssigneeId: reassignTo,
        reason: reassignReason.trim() || undefined,
      });
      toast.success("Task reassigned");
      setReassignTaskId(null);
      setReassignTo("");
      setReassignReason("");
    } catch {
      toast.error("Failed to reassign task");
    }
  };

  const handleEditTask = async (data: {
    taskId: string;
    title: string;
    description?: string;
    assignedTo?: string | null;
    projectId?: string | null;
    priority?: string;
    dueDate?: string | null;
    status?: string;
    blockedReason?: string;
    taskType?: string;
  }) => {
    try {
      await updateTask.mutateAsync(data);
      toast.success("Task updated successfully");
      setEditingTask(null);
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleTaskClick = (task: ManagedTask | KanbanCardData) => {
    setSelectedTask({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      project_name: task.project_name,
      assigned_to_name: task.assigned_to_name || null,
      reassignment_count: ((task as Record<string, unknown>).reassignment_count as number | undefined) ?? 0,
      blocked_reason: ((task as Record<string, unknown>).blocked_reason as string | null) ?? null,
      task_type: ((task as Record<string, unknown>).task_type as string | null) ?? null,
    });
    setDrawerOpen(true);
  };

  const handleGanttTaskClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) handleTaskClick(task);
  };

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.assigneeId && t.assigned_to_id !== filters.assigneeId) return false;
      if (filters.taskType && t.task_type !== filters.taskType) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) return false;
      }
      if (filters.dateRange.from && t.due_date && t.due_date < filters.dateRange.from) return false;
      if (filters.dateRange.to && t.due_date && t.due_date > filters.dateRange.to) return false;
      return true;
    });
    if (filters.tagIds.length > 0 && taskTagMap) {
      result = result.filter((t) => {
        const tagIdsForTask = taskTagMap.get(t.id) ?? [];
        return filters.tagIds.some((tagId) => tagIdsForTask.includes(tagId));
      });
    }
    return result;
  }, [tasks, filters, taskTagMap]);

  const kanbanTasks: KanbanCardData[] = filteredTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project_name: t.project_name,
    assigned_to_name: t.assigned_to_name,
    assigned_to_id: t.assigned_to_id,
    reassignment_count: t.reassignment_count,
    blocked_reason: t.blocked_reason,
    task_type: t.task_type,
  }));

  const ganttTasks = filteredTasks.map(t => ({
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

  const isLoading = membersLoading || projectsLoading || tasksLoading;

  const viewModes = [
    { value: "list" as ViewMode, icon: LayoutList, label: "List" },
    { value: "kanban" as ViewMode, icon: Columns3, label: "Kanban" },
    { value: "swimlane" as ViewMode, icon: LayoutGrid, label: "Swim Lane" },
    { value: "gantt" as ViewMode, icon: GanttChart, label: "Gantt" },
    { value: "dashboard" as ViewMode, icon: BarChart3, label: "Dashboard" },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Management</h2>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </Button>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
        {viewModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              onClick={() => setViewMode(mode.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center",
                viewMode === mode.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-card rounded-2xl p-5 shadow-soft border border-border/50 space-y-4"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            New Task
          </h3>

          {/* Task Type Selection */}
          <div className="flex gap-2">
            <button
              onClick={() => { setTaskType("project_task"); setProjectId(""); setAssignedToIds([]); }}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                taskType === "project_task"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Folder className="w-4 h-4" />
              Project Task
            </button>
            <button
              onClick={() => { setTaskType("separate_task"); setProjectId(""); setAssignedToIds([]); }}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                taskType === "separate_task"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Briefcase className="w-4 h-4" />
              Separate Task
            </button>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title *"
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          {/* Project selection (only for project tasks) */}
          {taskType === "project_task" && (
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setAssignedToIds([]); }}
                className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="">Select project *</option>
                {managerProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <Folder className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={taskType === "project_task" && !projectId}
                    className={cn(
                      "relative w-full min-h-[44px] p-3 pr-10 rounded-xl border border-border bg-background text-left focus:outline-none focus:ring-2 focus:ring-primary/20 flex flex-wrap items-center gap-2",
                      taskType === "project_task" && !projectId && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    {assignedToIds.length === 0 ? (
                      <span className="text-muted-foreground">
                        {taskType === "project_task" && !projectId
                          ? "Select a project first"
                          : "Assign to *"}
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground font-medium">
                          Assign To ({assignedToIds.length} selected)
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignedToIds.map((id) => {
                            const m = availableEmployees.find((e) => e.id === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-0.5 pl-1.5 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-xs"
                              >
                                {m?.full_name ?? id}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAssignedToIds((prev) => prev.filter((x) => x !== id)); }}
                                  className="p-0.5 hover:bg-primary/20 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
                  <div className="p-2 border-b border-border">
                    <Input
                      placeholder="Search by name..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="flex gap-1 p-2 border-b border-border flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAssignedToIds(availableEmployees.map((e) => e.id))}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Select All
                    </button>
                    {taskType === "separate_task" && assignableGrouped.employees.length > 0 && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => setAssignedToIds(assignableGrouped.employees.map((e) => e.id))}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Select All Employees
                        </button>
                      </>
                    )}
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignedToIds([])}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {taskType === "project_task" && projectId ? (
                      <>
                        {selectedProjectName && (
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1.5 sticky top-0 bg-background border-b border-border/50">
                            Assigning within: {selectedProjectName}
                          </p>
                        )}
                        {filteredEmployees.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No project members match</p>
                        ) : (
                          filteredEmployees.map((member) => (
                            <label
                              key={member.id}
                              className={cn(
                                "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                                assignedToIds.includes(member.id) ? "bg-primary/10" : "hover:bg-muted/60"
                              )}
                            >
                              <Checkbox
                                checked={assignedToIds.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  setAssignedToIds((prev) =>
                                    checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                                  );
                                }}
                              />
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                                {(member as { avatar_url?: string }).avatar_url ? (
                                  <img src={(member as { avatar_url: string }).avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (member.full_name || "?").slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{member.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </div>
                            </label>
                          ))
                        )}
                      </>
                    ) : taskType === "separate_task" ? (
                      membersLoadingResolved ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (filteredAssignableGrouped.seniorManagers.length > 0 || filteredAssignableGrouped.managers.length > 0 || filteredAssignableGrouped.employees.length > 0) ? (
                        <>
                          {filteredAssignableGrouped.seniorManagers.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/50">Senior Managers</p>
                              {filteredAssignableGrouped.seniorManagers.map((member) => (
                                <label
                                  key={member.id}
                                  className={cn(
                                    "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                                    assignedToIds.includes(member.id) ? "bg-primary/10" : "hover:bg-muted/60"
                                  )}
                                >
                                  <Checkbox
                                    checked={assignedToIds.includes(member.id)}
                                    onCheckedChange={(checked) => {
                                      setAssignedToIds((prev) =>
                                        checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                                      );
                                    }}
                                  />
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                                    {member.avatar_url ? (
                                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      (member.full_name || "?").slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{member.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {(member as { external_sub_role?: string }).external_sub_role || "Senior"}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                          {filteredAssignableGrouped.managers.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/50">Managers</p>
                              {filteredAssignableGrouped.managers.map((member) => (
                                <label
                                  key={member.id}
                                  className={cn(
                                    "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                                    assignedToIds.includes(member.id) ? "bg-primary/10" : "hover:bg-muted/60"
                                  )}
                                >
                                  <Checkbox
                                    checked={assignedToIds.includes(member.id)}
                                    onCheckedChange={(checked) => {
                                      setAssignedToIds((prev) =>
                                        checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                                      );
                                    }}
                                  />
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                                    {member.avatar_url ? (
                                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      (member.full_name || "?").slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{member.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                          {filteredAssignableGrouped.employees.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/50">Employees</p>
                              {filteredAssignableGrouped.employees.map((member) => (
                                <label
                                  key={member.id}
                                  className={cn(
                                    "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                                    assignedToIds.includes(member.id) ? "bg-primary/10" : "hover:bg-muted/60"
                                  )}
                                >
                                  <Checkbox
                                    checked={assignedToIds.includes(member.id)}
                                    onCheckedChange={(checked) => {
                                      setAssignedToIds((prev) =>
                                        checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                                      );
                                    }}
                                  />
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                                    {member.avatar_url ? (
                                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      (member.full_name || "?").slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{member.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">No one match</p>
                      )
                    ) : (
                      taskType === "project_task" && !projectId ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Select a project first</p>
                      ) : filteredEmployees.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No employees match</p>
                      ) : (
                        filteredEmployees.map((member) => (
                          <label
                            key={member.id}
                            className={cn(
                              "flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/60 cursor-pointer",
                              assignedToIds.includes(member.id) && "bg-primary/10"
                            )}
                          >
                            <Checkbox
                              checked={assignedToIds.includes(member.id)}
                              onCheckedChange={(checked) => {
                                setAssignedToIds((prev) =>
                                  checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                                );
                              }}
                            />
                            <span className="text-sm">{member.full_name}</span>
                          </label>
                        ))
                      )
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <Flag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="relative">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreateTask}
              disabled={createTask.isPending || !title.trim() || assignedToIds.length === 0}
              className="flex-1"
            >
              {createTask.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Task
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Assign mode dialog (standalone task, 2+ assignees) */}
      <Dialog open={assignModeDialogOpen} onOpenChange={(open) => { if (!open) setPendingCreatePayload(null); setAssignModeDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How should this task be assigned?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className={cn(
              "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
              assignMode === "individual" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            )}>
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === "individual"}
                onChange={() => setAssignMode("individual")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">Individual Tasks</p>
                <p className="text-sm text-muted-foreground">Separate task for each person</p>
              </div>
            </label>
            <label className={cn(
              "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
              assignMode === "shared" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            )}>
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === "shared"}
                onChange={() => setAssignMode("shared")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">Shared Task</p>
                <p className="text-sm text-muted-foreground">One task, assigned to the first person; all can view</p>
              </div>
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { setAssignModeDialogOpen(false); setPendingCreatePayload(null); }}>
              Cancel
            </Button>
            <Button onClick={handleAssignModeConfirm} disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Modal */}
      {reassignTaskId && (
        <div className="bg-card rounded-2xl p-5 shadow-soft border border-border/50 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Reassign Task
          </h3>
          <select
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background"
          >
            <option value="">Select new assignee</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
          <input
            type="text"
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full p-3 rounded-xl border border-border bg-background text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleReassign} disabled={!reassignTo || reassignTask.isPending} className="flex-1">
              {reassignTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reassign
            </Button>
            <Button variant="outline" onClick={() => setReassignTaskId(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Advanced Filters (hidden in dashboard view) */}
      {viewMode !== "dashboard" && (
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          assignees={assignees}
          showAssigneeFilter
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "dashboard" ? (
        <ProjectDashboard tasks={kanbanTasks} />
      ) : viewMode === "gantt" ? (
        <GanttTimeline tasks={ganttTasks} onTaskClick={handleGanttTaskClick} />
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tasks={kanbanTasks}
          onTaskClick={(task) => handleTaskClick(task)}
          onStatusChange={handleStatusChange}
        />
      ) : viewMode === "swimlane" ? (
        <KanbanSwimLaneBoard
          tasks={kanbanTasks}
          onTaskClick={(task) => handleTaskClick(task)}
          onStatusChange={handleStatusChange}
          groupBy={swimLaneGroupBy}
          onGroupByChange={setSwimLaneGroupBy}
        />
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-2xl">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">No tasks found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filters.status || filters.priority || filters.assigneeId || filters.taskType || filters.search || filters.tagIds.length > 0 || filters.dateRange.from || filters.dateRange.to
              ? "Try different filters"
              : "Create your first task above"}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {filteredTasks.map((task) => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              className="bg-card rounded-2xl p-4 shadow-soft border border-border/50 cursor-pointer hover:shadow-card transition-shadow"
              onClick={() => handleTaskClick(task)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <TaskStatusBadge status={task.status} />
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium)}>
                      {task.priority}
                    </span>
                    {task.task_type && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        task.task_type === "separate_task" ? "bg-violet-500/10 text-violet-600" : "bg-sky-500/10 text-sky-600"
                      )}>
                        {task.task_type === "separate_task" ? "Ad-hoc" : "Project"}
                      </span>
                    )}
                    {(task.reassignment_count || 0) > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <RefreshCw className="w-3 h-3" /> {task.reassignment_count}
                      </span>
                    )}
                  </div>

                  <h4 className={cn("font-medium", (task.status === "completed" || task.status === "approved") && "line-through text-muted-foreground")}>
                    {task.title}
                  </h4>

                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {task.assigned_to_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {task.assigned_to_name}
                      </span>
                    )}
                    {task.project_name && (
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3" /> {task.project_name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions dropdown */}
                <div className="relative group" onClick={(e) => e.stopPropagation()}>
                  <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
                    <button onClick={() => setEditingTask(task)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2">
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => setReassignTaskId(task.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Reassign
                    </button>
                    <hr className="my-1 border-border" />
                    {["pending", "in_progress", "review", "blocked", "completed", "approved"].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(task.id, task.status, s)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted capitalize flex items-center gap-2"
                      >
                        {s === "approved" && <ShieldCheck className="w-4 h-4" />}
                        {s.replace("_", " ")}
                      </button>
                    ))}
                    <hr className="my-1 border-border" />
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Archive
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Edit Task Modal */}
      <EditTaskModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        isSaving={updateTask.isPending}
        teamMembers={teamMembers}
        projects={projects}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canUploadEvidence={false}
        canManageTags
        canManageDependencies
        canCreateSubtasks
        allTasks={allTasksList}
      />
    </div>
  );
};
