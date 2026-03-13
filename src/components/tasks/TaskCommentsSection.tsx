import { useState } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskComments, useAddComment, useDeleteComment } from "@/hooks/useTaskComments";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface TaskCommentsSectionProps {
  taskId: string | null;
}

export const TaskCommentsSection = ({ taskId }: TaskCommentsSectionProps) => {
  const { data: comments, isLoading } = useTaskComments(taskId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState("");

  const handleSubmit = async () => {
    if (!newComment.trim() || !taskId) return;

    try {
      await addComment.mutateAsync({ taskId, content: newComment.trim() });
      setNewComment("");
    } catch {
      toast.error("Failed to add comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync(commentId);
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments list */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {!comments || comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No comments yet. Start the conversation.
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 rounded-xl bg-card border border-border/50 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.author_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
                {comment.is_own && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 mt-3 border-t border-border">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          placeholder="Write a comment..."
          className="flex-1 text-sm p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          className="px-3"
        >
          {addComment.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
