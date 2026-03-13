import { useState } from "react";
import { GitBranch, X, Plus, Loader2, Link2 } from "lucide-react";
import { useTaskDependencies, useAddDependency, useRemoveDependency } from "@/hooks/useTaskDependencies";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { toast } from "sonner";

interface DependenciesSectionProps {
  taskId: string;
  canManage?: boolean;
  allTasks?: { id: string; title: string }[];
}

export const DependenciesSection = ({ taskId, canManage = false, allTasks = [] }: DependenciesSectionProps) => {
  const { data: dependencies = [], isLoading } = useTaskDependencies(taskId);
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");
  const [depType, setDepType] = useState("blocks");

  const handleAdd = async () => {
    if (!selectedTask) return;
    try {
      await addDependency.mutateAsync({ taskId, dependsOn: selectedTask, dependencyType: depType });
      setSelectedTask("");
      setShowAdd(false);
      toast.success("Dependency added");
    } catch {
      toast.error("Failed to add dependency");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeDependency.mutateAsync({ id, taskId });
      toast.success("Dependency removed");
    } catch {
      toast.error("Failed to remove dependency");
    }
  };

  const availableTasks = allTasks.filter(
    t => t.id !== taskId && !dependencies.some(d => d.depends_on === t.id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dependencies.length > 0 ? (
        <div className="space-y-2">
          {dependencies.map(dep => (
            <div key={dep.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
                {dep.dependency_type === "blocks" ? "Blocked by" : "Related to"}
              </span>
              <span className="text-sm flex-1 truncate">{dep.depends_on_title}</span>
              <TaskStatusBadge status={dep.depends_on_status} />
              {canManage && (
                <button
                  onClick={() => handleRemove(dep.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
          <Link2 className="w-4 h-4" />
          No dependencies
        </p>
      )}

      {canManage && (
        <>
          {showAdd ? (
            <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/50">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              >
                <option value="">Select a task...</option>
                {availableTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <select
                value={depType}
                onChange={(e) => setDepType(e.target.value)}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              >
                <option value="blocks">Blocked by</option>
                <option value="related">Related to</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!selectedTask || addDependency.isPending}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
                >
                  Add
                </button>
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm rounded-lg bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Dependency
            </button>
          )}
        </>
      )}
    </div>
  );
};
