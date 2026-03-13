import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { KanbanCard, KanbanCardData } from "./KanbanCard";
import { statusConfig } from "@/components/tasks/TaskStatusBadge";
import { cn } from "@/lib/utils";

const KANBAN_STATUSES = ["pending", "in_progress", "review", "blocked", "completed", "approved"];

interface KanbanBoardProps {
  tasks: KanbanCardData[];
  onTaskClick: (task: KanbanCardData) => void;
  onStatusChange: (taskId: string, oldStatus: string | null, newStatus: string) => void;
  visibleStatuses?: string[];
}

export const KanbanBoard = ({ tasks, onTaskClick, onStatusChange, visibleStatuses }: KanbanBoardProps) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const statuses = visibleStatuses || KANBAN_STATUSES;

  const columns = statuses.map((status) => ({
    status,
    config: statusConfig[status] || statusConfig.pending,
    tasks: tasks.filter((t) => (t.status || "pending") === status),
  }));

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task || (task.status || "pending") === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    onStatusChange(draggedTaskId, task.status, newStatus);
    setDraggedTaskId(null);
  }, [draggedTaskId, tasks, onStatusChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }, []);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x">
      {columns.map(({ status, config, tasks: columnTasks }) => {
        const Icon = config.icon;
        return (
          <div
            key={status}
            className={cn(
              "flex-shrink-0 w-[280px] rounded-2xl border border-border/50 bg-muted/30 flex flex-col max-h-[calc(100vh-280px)] snap-start",
              dragOverStatus === status && "ring-2 ring-primary/40 bg-primary/5"
            )}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{config.label}</span>
              <span className="ml-auto text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                {columnTasks.length}
              </span>
            </div>

            {/* Column Body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {columnTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    onDragEnd={handleDragEnd}
                  >
                    <KanbanCard
                      task={task}
                      onClick={() => onTaskClick(task)}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        handleDragStart(task.id);
                      }}
                      isDragging={draggedTaskId === task.id}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
