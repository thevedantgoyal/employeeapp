import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Paperclip, Loader2, XCircle, ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserTasks, useCreateContribution } from "@/hooks/useContributions";
import { useToast } from "@/hooks/use-toast";
import { FileUploader, type UploadedFileInfo } from "@/components/upload/FileUploader";

interface AddWorkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddWorkUpdateModal = ({ isOpen, onClose }: AddWorkUpdateModalProps) => {
  const [selectedTask, setSelectedTask] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidencePath, setEvidencePath] = useState<string | null>(null);
  const [evidenceDisplayUrl, setEvidenceDisplayUrl] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<string | null>(null);

  const { data: tasks, isLoading: tasksLoading } = useUserTasks();
  const createContribution = useCreateContribution();
  const { toast } = useToast();

  const onUploadComplete = (uploadedFiles: UploadedFileInfo[]) => {
    const f = uploadedFiles[0];
    if (!f) return;
    setEvidencePath(f.id);
    setEvidenceDisplayUrl(f.url);
    setEvidenceType(f.type);
  };

  const removeEvidence = () => {
    setEvidencePath(null);
    setEvidenceDisplayUrl(null);
    setEvidenceType(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    try {
      await createContribution.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        taskId: selectedTask || undefined,
        evidenceUrl: evidencePath || undefined,
        evidenceType: evidenceType || undefined,
      });
      
      toast({
        title: "Work update submitted",
        description: "Your contribution has been submitted for review.",
      });
      
      setSelectedTask("");
      setTitle("");
      setDescription("");
      setEvidencePath(null);
      setEvidenceDisplayUrl(null);
      setEvidenceType(null);
      onClose();
    } catch (error) {
      toast({
        title: "Failed to submit",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-elevated max-h-[85vh] overflow-auto"
          >
            <div className="p-6 max-w-lg mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-display font-semibold">Add Work Update</h2>
                <div className="w-9" />
              </div>

              <div className="space-y-6">
                {/* Title Input */}
                <div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full p-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Task Select */}
                <div className="relative">
                  <select
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    disabled={tasksLoading}
                    className="w-full p-4 pr-10 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                  >
                    <option value="">Select Ongoing Task (Optional)</option>
                    {tasks?.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.project_name ? `[${task.project_name}] ` : ""}{task.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  {tasksLoading && (
                    <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                </div>
                {selectedTask && tasks?.find(t => t.id === selectedTask) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg text-sm text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Linked to: {tasks.find(t => t.id === selectedTask)?.title}</span>
                  </div>
                )}

                {/* Description */}
                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    rows={5}
                    className="w-full p-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Evidence Preview */}
                {evidenceDisplayUrl && (
                  <div className="relative bg-muted rounded-xl p-4">
                    <button
                      onClick={removeEvidence}
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    {evidenceType?.startsWith("image") && evidenceDisplayUrl?.trim() ? (
                      <img
                        src={evidenceDisplayUrl.trim()}
                        alt="Evidence"
                        className="max-h-40 rounded-lg mx-auto"
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm truncate">Evidence attached</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachment */}
                {!evidenceDisplayUrl && (
                  <FileUploader
                    multiple={false}
                    allowedTypes={["image/*", "application/pdf", ".doc", ".docx", ".xls", ".xlsx", "text/plain"]}
                    maxFileSizeMB={10}
                    bucket="evidence"
                    label="Attach File"
                    onUploadComplete={onUploadComplete}
                  />
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || !description.trim() || createContribution.isPending}
                  className="w-full py-6 text-base font-semibold rounded-xl"
                >
                  {createContribution.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Submit Update"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
