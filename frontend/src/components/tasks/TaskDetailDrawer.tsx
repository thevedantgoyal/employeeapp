import { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskActivityTimeline } from "./TaskActivityTimeline";
import { TaskEvidenceSection } from "./TaskEvidenceSection";
import { TaskCommentsSection } from "./TaskCommentsSection";
import { SubtasksSection } from "./SubtasksSection";
import { DependenciesSection } from "./DependenciesSection";
import { TagsSection } from "./TagsSection";
import { Calendar, Folder, User, Flag, RefreshCw } from "lucide-react";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface TaskDetailData {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_name: string | null;
  assigned_to_name?: string | null;
  reassignment_count?: number;
  blocked_reason?: string | null;
  task_type?: string | null;
  task_date?: string | null;
  duration_hours?: number | null;
}

interface TaskDetailDrawerProps {
  task: TaskDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUploadEvidence?: boolean;
  canManageTags?: boolean;
  canManageDependencies?: boolean;
  canCreateSubtasks?: boolean;
  allTasks?: { id: string; title: string }[];
}

const priorityLabels: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TaskDetailDrawer = ({
  task,
  open,
  onOpenChange,
  canUploadEvidence = false,
  canManageTags = false,
  canManageDependencies = false,
  canCreateSubtasks = false,
  allTasks = [],
}: TaskDetailDrawerProps) => {
  const [activeTab, setActiveTab] = useState("details");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const isOverdue = !!(task?.due_date && isPast(new Date(task.due_date)) && task.status !== "completed" && task.status !== "approved");
  const deadlineStatus = useMemo(() => {
    const raw = task?.due_date || task?.task_date;
    if (!raw || task?.status === "completed" || task?.status === "approved") return null;
    const end = new Date(raw);
    if (Number.isNaN(end.getTime())) return null;
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    if (now > endDay) return { label: "Past deadline", className: "bg-destructive/10 text-destructive" as const };
    const ms = endDay.getTime() - now.getTime();
    if (ms > 48 * 60 * 60 * 1000) return null;
    const h = Math.floor(ms / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return {
      label: h > 0 ? `Due in ${h}h ${String(m).padStart(2, "0")}m` : `Due in ${m}m`,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" as const,
    };
  }, [task?.due_date, task?.task_date, task?.status, now]);

  if (!task) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TaskStatusBadge status={task.status} />
            {(task.reassignment_count ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Reassigned {task.reassignment_count}x
              </span>
            )}
          </div>
          <DrawerTitle className="text-lg mt-1">{task.title}</DrawerTitle>
          {task.description && (
            <DrawerDescription className="text-sm mt-1">
              {task.description}
            </DrawerDescription>
          )}
          {/* Tags inline */}
          <div className="mt-2">
            <TagsSection taskId={task.id} canManage={canManageTags} />
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
              <TabsTrigger value="subtasks" className="flex-1 text-xs">Subtasks</TabsTrigger>
              <TabsTrigger value="evidence" className="flex-1 text-xs">Evidence</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 text-xs">Activity</TabsTrigger>
              <TabsTrigger value="comments" className="flex-1 text-xs">Comments</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Meta info */}
              <div className="space-y-2.5">
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
                {task.priority && (
                  <div className="flex items-center gap-2 text-sm">
                    <Flag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Priority:</span>
                    <span className="font-medium">{priorityLabels[task.priority] || task.priority}</span>
                  </div>
                )}
                {task.due_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Due:</span>
                    <span className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                      {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                      {isOverdue && " (Overdue)"}
                    </span>
                  </div>
                )}
                {(task.duration_hours != null && task.duration_hours > 0) || task.task_date ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-medium">Effort & schedule</p>
                    {task.task_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Work date:</span>
                        <span className="font-medium">{format(new Date(task.task_date), "dd MMM yyyy")}</span>
                      </div>
                    )}
                    {task.duration_hours != null && task.duration_hours > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Estimated duration:</span>
                        <span className="font-medium">
                          {Math.floor(task.duration_hours)}h {String(Math.round((task.duration_hours % 1) * 60)).padStart(2, "0")}m
                        </span>
                      </div>
                    )}
                    {deadlineStatus && (
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", deadlineStatus.className)}>
                        {deadlineStatus.label}
                      </span>
                    )}
                  </div>
                ) : null}
                {task.task_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium capitalize">{task.task_type.replace("_", " ")}</span>
                  </div>
                )}
                {task.blocked_reason && task.status === "blocked" && (
                  <div className="mt-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">Blocked Reason</p>
                    <p className="text-sm text-muted-foreground mt-1">{task.blocked_reason}</p>
                  </div>
                )}
              </div>

              {/* Dependencies */}
              <div>
                <h4 className="text-sm font-medium mb-2">Dependencies</h4>
                <DependenciesSection
                  taskId={task.id}
                  canManage={canManageDependencies}
                  allTasks={allTasks}
                />
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="mt-4">
              <SubtasksSection taskId={task.id} canCreate={canCreateSubtasks} />
            </TabsContent>

            <TabsContent value="evidence" className="mt-4">
              <TaskEvidenceSection taskId={task.id} canUpload={canUploadEvidence} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <TaskActivityTimeline taskId={task.id} />
            </TabsContent>

            <TabsContent value="comments" className="mt-4">
              <TaskCommentsSection taskId={task.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
