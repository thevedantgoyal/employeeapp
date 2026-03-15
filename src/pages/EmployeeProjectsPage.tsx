import { useState } from "react";
import { motion } from "framer-motion";
import { Folder, Calendar, Users, ListTodo, Building, Loader2 } from "lucide-react";
import { useEmployeeProjects, useProjectMembersDetails, type ProjectMemberDetail } from "@/hooks/useProjectManagement";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

type ProjectForDetail = { id: string; name: string; description: string | null; project_type: string; due_date: string | null; created_by: string | null };

const EmployeeProjectsPage = () => {
  const { data: projects, isLoading, error } = useEmployeeProjects();
  const [detailProject, setDetailProject] = useState<ProjectForDetail | null>(null);
  const { data: memberDetails = [], isLoading: detailsLoading } = useProjectMembersDetails(detailProject?.id ?? null);
  const managersList = memberDetails.filter((m) => (m.external_role || "").toLowerCase() === "manager" || (m.external_role || "").toLowerCase() === "subadmin");
  const employeesList = memberDetails.filter((m) => (m.external_role || "").toLowerCase() !== "manager" && (m.external_role || "").toLowerCase() !== "subadmin");

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
              {(project as { member_count?: number }).member_count ?? project.members.length} member{((project as { member_count?: number }).member_count ?? project.members.length) !== 1 ? "s" : ""}
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

          <Button
            variant="ghost"
            size="sm"
            className="text-xs mt-2 w-full"
            onClick={() => setDetailProject({ id: project.id, name: project.name, description: project.description ?? null, project_type: project.project_type, due_date: project.due_date ?? null, created_by: project.created_by ?? null })}
          >
            View details
          </Button>
        </motion.div>
      ))}

      <Sheet open={!!detailProject} onOpenChange={(open) => { if (!open) setDetailProject(null); }}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" />
              {detailProject?.name}
            </SheetTitle>
          </SheetHeader>
          {detailProject && (
            <div className="flex-1 overflow-y-auto space-y-4 pt-4">
              {detailProject.description && (
                <p className="text-sm text-muted-foreground">{detailProject.description}</p>
              )}
              {detailProject.due_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Due {format(new Date(detailProject.due_date), "dd MMM yyyy")}
                </div>
              )}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${detailProject.project_type === "client" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                {detailProject.project_type === "client" ? "Client" : "In-house"}
              </span>
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Team Members ({memberDetails.length})
                </h4>
                {detailsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {managersList.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Managers</p>
                        <div className="space-y-2">
                          {managersList.map((m) => (
                            <EmployeeProjectMemberCard key={m.id} member={m} />
                          ))}
                        </div>
                      </div>
                    )}
                    {employeesList.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Employees</p>
                        <div className="space-y-2">
                          {employeesList.map((m) => (
                            <EmployeeProjectMemberCard key={m.id} member={m} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};

function EmployeeProjectMemberCard({ member }: { member: ProjectMemberDetail }) {
  const roleLabel = (member.external_role || "employee").toLowerCase() === "subadmin" ? (member.external_sub_role || "Subadmin") : (member.external_role || "Employee");
  const roleBadgeClass = (member.external_role || "").toLowerCase() === "manager" ? "bg-primary/10 text-primary text-[10px]" : (member.external_role || "").toLowerCase() === "subadmin" ? "bg-orange-500/10 text-orange-600 text-[10px]" : "bg-muted text-muted-foreground text-[10px]";
  return (
    <button
      type="button"
      onClick={() => window.open(`/profile/${member.user_id}`, "_self")}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-medium text-primary">
        {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (member.full_name || "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{member.full_name}</span>
          <span className={`px-1.5 py-0.5 rounded-full font-medium ${roleBadgeClass}`}>{roleLabel}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Added: {member.added_to_project_at ? format(new Date(member.added_to_project_at), "dd MMM yyyy") : "—"}</p>
      </div>
    </button>
  );
}

export default EmployeeProjectsPage;
