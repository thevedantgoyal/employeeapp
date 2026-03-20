import { useState } from "react";
import { Plus, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useSubtasks, useCreateSubtask } from "@/hooks/useSubtasks";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubtasksSectionProps {
  taskId: string;
  canCreate?: boolean;
}

export const SubtasksSection = ({ taskId, canCreate = false }: SubtasksSectionProps) => {
  const { data: subtasks = [], isLoading } = useSubtasks(taskId);
  const createSubtask = useCreateSubtask();
  const [newTitle, setNewTitle] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createSubtask.mutateAsync({ parentTaskId: taskId, title: newTitle.trim() });
      setNewTitle("");
      setShowForm(false);
      toast.success("Subtask created");
    } catch {
      toast.error("Failed to create subtask");
    }
  };

  const completedCount = subtasks.filter(s => s.status === "completed" || s.status === "approved").length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subtasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedCount}/{subtasks.length} completed</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {subtasks.map(subtask => {
          const isDone = subtask.status === "completed" || subtask.status === "approved";
          return (
            <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn("text-sm flex-1", isDone && "line-through text-muted-foreground")}>
                {subtask.title}
              </span>
              <TaskStatusBadge status={subtask.status} />
            </div>
          );
        })}
      </div>

      {subtasks.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No subtasks yet</p>
      )}

      {canCreate && (
        <>
          {showForm ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Subtask title..."
                className="flex-1 p-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={createSubtask.isPending || !newTitle.trim()}
                className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {createSubtask.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
              </button>
              <button
                onClick={() => { setShowForm(false); setNewTitle(""); }}
                className="px-3 py-2 text-sm rounded-lg bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Subtask
            </button>
          )}
        </>
      )}
    </div>
  );
};
