import { motion } from "framer-motion";
import { Folder, Calendar, Users, ListTodo, Building, Loader2 } from "lucide-react";
import { useEmployeeProjects } from "@/hooks/useProjectManagement";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const EmployeeProjectsPage = () => {
  const { data: projects, isLoading, error } = useEmployeeProjects();

  if (isLoading) {
    return <ConnectPlusLoader variant="inline" message="Loading projects..." />;
  }

  if (error) {
    return <div className="text-center py-12 text-destructive">Failed to load projects</div>;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
        <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold">No projects assigned</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Projects will appear here when your manager assigns you
        </p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
      {projects.map((project) => (
        <motion.div
          key={project.id}
          variants={itemVariants}
          className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Folder className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.description}</p>
                )}
              </div>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                project.project_type === "client"
                  ? "bg-blue-500/10 text-blue-600"
                  : "bg-emerald-500/10 text-emerald-600"
              }`}
            >
              {project.project_type === "client" ? "Client" : "In-house"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {project.due_date && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(project.due_date).toLocaleDateString()}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {project.members.length} member{project.members.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ListTodo className="w-3.5 h-3.5" />
              {(project as { taskCount?: number }).taskCount ?? 0} task{((project as { taskCount?: number }).taskCount ?? 0) !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Team members */}
          <div className="flex flex-wrap gap-1">
            {project.members.map((m) => (
              <span
                key={m.id}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {m.full_name}
              </span>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default EmployeeProjectsPage;
