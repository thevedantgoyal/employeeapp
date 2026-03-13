import { useState } from "react";
import { Tag, Plus, X, Loader2 } from "lucide-react";
import { useAllTags, useTaskTagAssignments, useAssignTag, useRemoveTagAssignment, useCreateTag } from "@/hooks/useTaskTags";
import { toast } from "sonner";

interface TagsSectionProps {
  taskId: string;
  canManage?: boolean;
}

const TAG_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

export const TagsSection = ({ taskId, canManage = false }: TagsSectionProps) => {
  const { data: allTags = [] } = useAllTags();
  const { data: assignments = [], isLoading } = useTaskTagAssignments(taskId);
  const assignTag = useAssignTag();
  const removeAssignment = useRemoveTagAssignment();
  const createTag = useCreateTag();
  const [showAdd, setShowAdd] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showCreateTag, setShowCreateTag] = useState(false);

  const assignedTagIds = assignments.map(a => a.tag_id);
  const availableTags = allTags.filter(t => !assignedTagIds.includes(t.id));

  const handleAssign = async (tagId: string) => {
    try {
      await assignTag.mutateAsync({ taskId, tagId });
    } catch {
      toast.error("Failed to assign tag");
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await removeAssignment.mutateAsync({ id: assignmentId, taskId });
    } catch {
      toast.error("Failed to remove tag");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      if (tag) await assignTag.mutateAsync({ taskId, tagId: tag.id });
      setNewTagName("");
      setShowCreateTag(false);
      toast.success("Tag created and assigned");
    } catch {
      toast.error("Failed to create tag");
    }
  };

  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;
  }

  return (
    <div className="space-y-3">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {assignments.map(a => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
            style={{ backgroundColor: `${a.tag_color}20`, color: a.tag_color }}
          >
            <Tag className="w-2.5 h-2.5" />
            {a.tag_name}
            {canManage && (
              <button onClick={() => handleRemove(a.id)} className="hover:opacity-70">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {assignments.length === 0 && (
          <p className="text-xs text-muted-foreground">No tags</p>
        )}
      </div>

      {canManage && (
        <>
          {showAdd ? (
            <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/50">
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAssign(tag.id)}
                      className="text-xs px-2 py-1 rounded-full font-medium hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      + {tag.name}
                    </button>
                  ))}
                </div>
              )}

              {showCreateTag ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="w-full p-2 text-sm rounded-lg border border-border bg-background"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {TAG_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className="w-5 h-5 rounded-full border-2 transition-transform"
                        style={{
                          backgroundColor: c,
                          borderColor: newTagColor === c ? "var(--foreground)" : "transparent",
                          transform: newTagColor === c ? "scale(1.2)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || createTag.isPending}
                      className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button onClick={() => setShowCreateTag(false)} className="px-3 py-1.5 text-sm rounded-lg bg-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateTag(true)} className="text-xs text-primary font-medium hover:underline">
                  + Create new tag
                </button>
              )}

              <button onClick={() => setShowAdd(false)} className="text-xs text-muted-foreground hover:underline">
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Manage Tags
            </button>
          )}
        </>
      )}
    </div>
  );
};
