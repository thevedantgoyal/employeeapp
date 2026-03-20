import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  User,
  Folder,
  Flag,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagedTask, TeamMember, Project } from "@/hooks/useTaskManagement";

interface EditTaskModalProps {
  task: ManagedTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
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
  }) => Promise<void>;
  isSaving: boolean;
  teamMembers: TeamMember[];
  projects: Project[];
}

export const EditTaskModal = ({
  task,
  isOpen,
  onClose,
  onSave,
  isSaving,
  teamMembers,
  projects,
}: EditTaskModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [taskType, setTaskType] = useState("project_task");
  const [blockedReason, setBlockedReason] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setAssignedTo(task.assigned_to_id || "");
      setProjectId("");
      setPriority(task.priority || "medium");
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setStatus(task.status || "pending");
      setTaskType(task.task_type || "project_task");
      setBlockedReason(task.blocked_reason || "");
    }
  }, [task]);

  const handleSubmit = async () => {
    if (!task || !title.trim()) return;

    await onSave({
      taskId: task.id,
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: assignedTo || null,
      projectId: projectId || null,
      priority,
      dueDate: dueDate || null,
      status,
      blockedReason: status === "blocked" ? blockedReason.trim() : undefined,
      taskType,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] max-w-lg mx-auto bg-card rounded-2xl shadow-xl border border-border z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Edit Task</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description"
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Status & Task Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">In Review</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    <option value="project_task">Project Task</option>
                    <option value="adhoc_task">Ad-hoc Task</option>
                  </select>
                </div>
              </div>

              {/* Blocked reason (conditional) */}
              {status === "blocked" && (
                <div>
                  <label className="text-sm font-medium text-destructive mb-1.5 block">Blocked Reason *</label>
                  <textarea
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    placeholder="Why is this task blocked?"
                    rows={2}
                    className="w-full p-3 rounded-xl border border-destructive/30 bg-background focus:outline-none focus:ring-2 focus:ring-destructive/20 resize-none"
                  />
                </div>
              )}

              {/* Assign To & Project */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Assign To</label>
                  <div className="relative">
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>{member.full_name}</option>
                      ))}
                    </select>
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Project</label>
                  <div className="relative">
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                    <Folder className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Priority & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Priority</label>
                  <div className="relative">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <Flag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Due Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-border">
              <Button onClick={handleSubmit} disabled={isSaving || !title.trim()} className="flex-1">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
