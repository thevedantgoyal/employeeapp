import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { KanbanCard, KanbanCardData } from "./KanbanCard";
import { statusConfig } from "@/components/tasks/TaskStatusBadge";
import { cn } from "@/lib/utils";
import { User, Folder, ChevronDown, ChevronRight } from "lucide-react";

const KANBAN_STATUSES = ["pending", "in_progress", "review", "blocked", "completed", "approved"];

type GroupBy = "assignee" | "project";

interface KanbanSwimLaneBoardProps {
  tasks: KanbanCardData[];
  onTaskClick: (task: KanbanCardData) => void;
  onStatusChange: (taskId: string, oldStatus: string | null, newStatus: string) => void;
  groupBy?: GroupBy;
  onGroupByChange?: (groupBy: GroupBy) => void;
}

export const KanbanSwimLaneBoard = ({
  tasks,
  onTaskClick,
  onStatusChange,
  groupBy = "assignee",
  onGroupByChange,
}: KanbanSwimLaneBoardProps) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());

  const lanes = useMemo(() => {
    const groups = new Map<string, KanbanCardData[]>();

    tasks.forEach((task) => {
      const key = groupBy === "assignee"
        ? (task.assigned_to_name || "Unassigned")
        : (task.project_name || "No Project");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Unassigned" || a === "No Project") return 1;
      if (b === "Unassigned" || b === "No Project") return -1;
      return a.localeCompare(b);
    });
  }, [tasks, groupBy]);

  const toggleLane = (lane: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });
  };

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task || (task.status || "pending") === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    onStatusChange(draggedTaskId, task.status, newStatus);
    setDraggedTaskId(null);
  }, [draggedTaskId, tasks, onStatusChange]);

  return (
    <div className="space-y-2">
      {/* Group By Toggle */}
      {onGroupByChange && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground font-medium">Group by:</span>
          <button
            onClick={() => onGroupByChange("assignee")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1",
              groupBy === "assignee" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
            )}
          >
            <User className="w-3 h-3" /> Assignee
          </button>
          <button
            onClick={() => onGroupByChange("project")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1",
              groupBy === "project" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
            )}
          >
            <Folder className="w-3 h-3" /> Project
          </button>
        </div>
      )}

      {/* Status Header Row */}
      <div className="flex gap-0 overflow-x-auto pb-1">
        <div className="w-[140px] flex-shrink-0" />
        {KANBAN_STATUSES.map((status) => {
          const config = statusConfig[status] || statusConfig.pending;
          const Icon = config.icon;
          return (
            <div key={status} className="w-[160px] flex-shrink-0 px-1">
              <div className="flex items-center gap-1.5 py-2 px-2 text-xs font-semibold text-muted-foreground">
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Swim Lanes */}
      {lanes.map(([laneName, laneTasks]) => {
        const isCollapsed = collapsedLanes.has(laneName);
        const totalCount = laneTasks.length;

        return (
          <div key={laneName} className="border border-border/30 rounded-xl bg-muted/20 overflow-hidden">
            {/* Lane Header */}
            <button
              onClick={() => toggleLane(laneName)}
              className="flex items-center gap-2 w-full p-3 hover:bg-muted/40 transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {groupBy === "assignee" ? <User className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-primary" />}
              <span className="text-sm font-semibold">{laneName}</span>
              <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground ml-auto">
                {totalCount} task{totalCount !== 1 ? "s" : ""}
              </span>
            </button>

            {/* Lane Content */}
            {!isCollapsed && (
              <div className="flex gap-0 overflow-x-auto px-1 pb-2">
                <div className="w-[140px] flex-shrink-0" />
                {KANBAN_STATUSES.map((status) => {
                  const cellTasks = laneTasks.filter((t) => (t.status || "pending") === status);
                  const cellKey = `${laneName}-${status}`;

                  return (
                    <div
                      key={cellKey}
                      className={cn(
                        "w-[160px] flex-shrink-0 px-1 min-h-[60px]",
                        dragOverCell === cellKey && "bg-primary/5 rounded-lg"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCell(cellKey);
                      }}
                      onDragLeave={() => setDragOverCell(null)}
                      onDrop={(e) => handleDrop(e, status)}
                    >
                      <div className="space-y-1.5">
                        {cellTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.15 }}
                          >
                            <KanbanCard
                              task={task}
                              onClick={() => onTaskClick(task)}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                handleDragStart(task.id);
                              }}
                              isDragging={draggedTaskId === task.id}
                              compact
                            />
                          </motion.div>
                        ))}
                        {cellTasks.length === 0 && (
                          <div className="text-center py-3 text-[10px] text-muted-foreground/50">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {lanes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No tasks to display</div>
      )}
    </div>
  );
};
