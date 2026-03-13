import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Calendar, Users, Folder, Loader2, Briefcase, Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamMembers } from "@/hooks/useTaskManagement";
import { useManagerProjects, useCreateProject } from "@/hooks/useProjectManagement";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const ProjectManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("inhouse");
  const [dueDate, setDueDate] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();
  const { data: projects = [], isLoading: projectsLoading } = useManagerProjects();
  const createProject = useCreateProject();

  const resetForm = () => {
    setName("");
    setDescription("");
    setProjectType("inhouse");
    setDueDate("");
    setSelectedEmployees([]);
    setShowForm(false);
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Project title is required");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error("Select at least one employee");
      return;
    }

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        projectType,
        dueDate,
        employeeIds: selectedEmployees,
      });
      toast.success("Project created successfully");
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  const isLoading = membersLoading || projectsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Create Project
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-2xl p-5 shadow-soft border border-border/50 space-y-4"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            New Project
          </h3>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project title *"
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="inhouse">In-house</option>
                <option value="client">Client</option>
              </select>
              <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
          </div>

          {/* Employee Selection */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Assign Employees ({selectedEmployees.length} selected)
            </p>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No direct reports found</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-xl bg-background">
                {teamMembers.map((member) => {
                  const isSelected = selectedEmployees.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleEmployee(member.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {member.full_name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreate}
              disabled={createProject.isPending || !name.trim() || !dueDate}
              className="flex-1"
            >
              {createProject.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Project
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Project List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length > 0 ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              variants={itemVariants}
              className="bg-card rounded-2xl p-4 shadow-soft border border-border/50"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Folder className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    project.project_type === "client"
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {project.project_type === "client" ? "Client" : "In-house"}
                </span>
              </div>

              {/* Due Date */}
              {project.due_date && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Calendar className="w-3 h-3" />
                  Due {new Date(project.due_date).toLocaleDateString()}
                </div>
              )}

              {/* Members */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Users className="w-3 h-3" />
                {project.members.length} employee{project.members.length !== 1 ? "s" : ""}
              </div>

              {/* Member chips */}
              <div className="flex flex-wrap gap-1">
                {project.members.slice(0, 5).map((m) => (
                  <span
                    key={m.id}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {m.full_name}
                  </span>
                ))}
                {project.members.length > 5 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    +{project.members.length - 5} more
                  </span>
                )}
              </div>

              <div className="text-[10px] text-muted-foreground mt-2">
                Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first project to organize tasks
          </p>
        </div>
      )}
    </div>
  );
};
