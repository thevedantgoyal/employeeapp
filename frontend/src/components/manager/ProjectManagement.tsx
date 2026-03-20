import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus, Calendar, Users, Folder, Loader2, Briefcase, Building, X, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamMembers } from "@/hooks/useTaskManagement";
import {
  useManagerProjects,
  useCreateProject,
  useAssignableForProject,
  useProjectMembersDetails,
  useRemoveProjectMember,
  type ProjectWithMembers,
  type ProjectMemberDetail,
} from "@/hooks/useProjectManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/api/db";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const ProjectManagement = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("inhouse");
  const [dueDate, setDueDate] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [detailProject, setDetailProject] = useState<ProjectWithMembers | null>(null);

  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();
  const { data: assignableForProject = [], isLoading: assignableProjectLoading } = useAssignableForProject();
  const { data: projects = [], isLoading: projectsLoading } = useManagerProjects();
  const createProject = useCreateProject();

  const isSubadmin = (user as { userType?: string; external_role?: string } | null)?.userType === "SENIOR_MANAGER"
    || (user as { external_role?: string } | null)?.external_role === "subadmin";
  const projectCreationList = isSubadmin ? assignableForProject : (assignableForProject.length > 0 ? assignableForProject : teamMembers);
  const projectCreationLoading = isSubadmin ? assignableProjectLoading : (assignableForProject.length > 0 ? assignableProjectLoading : membersLoading);

  type AssignableItem = { id: string; full_name: string; job_title?: string | null; avatar_url?: string | null; employee_code?: string | null; external_role?: string };
  const projectCreationAssignable = projectCreationList as AssignableItem[];
  const managersGroup = useMemo(
    () => projectCreationAssignable.filter((u) => (u.external_role || "").toLowerCase() === "manager"),
    [projectCreationAssignable]
  );
  const employeesGroup = useMemo(
    () => projectCreationAssignable.filter((u) => (u.external_role || "").toLowerCase() !== "manager"),
    [projectCreationAssignable]
  );
  const hasRoleGrouping = projectCreationAssignable.some((u) => u.external_role != null && u.external_role !== "");
  const assigneeSearchLower = assigneeSearch.trim().toLowerCase();
  const filteredManagers = useMemo(
    () => (assigneeSearchLower ? managersGroup.filter((m) => m.full_name.toLowerCase().includes(assigneeSearchLower)) : managersGroup),
    [managersGroup, assigneeSearchLower]
  );
  const filteredEmployees = useMemo(
    () => (assigneeSearchLower ? employeesGroup.filter((m) => m.full_name.toLowerCase().includes(assigneeSearchLower)) : employeesGroup),
    [employeesGroup, assigneeSearchLower]
  );

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await db.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      return data as { id: string } | null;
    },
    enabled: !!user,
  });
  const myProfileId = myProfile?.id ?? null;
  const { data: memberDetails = [], isLoading: detailsLoading } = useProjectMembersDetails(detailProject?.id ?? null);
  const removeMember = useRemoveProjectMember();
  const isCreator = detailProject && myProfileId && detailProject.created_by === myProfileId;

  const managersList = useMemo(() => memberDetails.filter((m) => (m.external_role || "").toLowerCase() === "manager" || (m.external_role || "").toLowerCase() === "subadmin"), [memberDetails]);
  const employeesList = useMemo(() => memberDetails.filter((m) => (m.external_role || "").toLowerCase() !== "manager" && (m.external_role || "").toLowerCase() !== "subadmin"), [memberDetails]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setProjectType("inhouse");
    setDueDate("");
    setSelectedEmployees([]);
    setAssigneeSearch("");
    setShowForm(false);
  };

  const selectAllAssignees = () => setSelectedEmployees(projectCreationAssignable.map((u) => u.id));
  const selectAllEmployeesOnly = () => setSelectedEmployees(employeesGroup.map((u) => u.id));
  const clearAllAssignees = () => setSelectedEmployees([]);
  const removeAssigneeChip = (id: string) => setSelectedEmployees((prev) => prev.filter((e) => e !== id));

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
        allowAnyAssignable: isSubadmin,
      });
      toast.success("Project created successfully");
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  const isLoading = projectCreationLoading || projectsLoading;

  const handleRemoveMember = async (profileId: string, fullName: string) => {
    if (!detailProject) return;
    if (!confirm(`Remove ${fullName} from this project? Their assigned tasks will remain.\n\n[Cancel] [Remove]`)) return;
    try {
      await removeMember.mutateAsync({ projectId: detailProject.id, profileId });
      toast.success("Member removed from project");
    } catch {
      toast.error("Failed to remove member");
    }
  };

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
            {projectCreationLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : projectCreationList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {isSubadmin ? "No assignable users found" : "No direct reports found"}
              </p>
            ) : (
              <div className="border border-border rounded-xl bg-background overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input
                    placeholder="Search by name..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex gap-1 p-2 border-b border-border flex-wrap items-center">
                  <button type="button" onClick={selectAllAssignees} className="text-xs font-medium text-primary hover:underline">
                    Select All
                  </button>
                  {hasRoleGrouping && employeesGroup.length > 0 && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <button type="button" onClick={selectAllEmployeesOnly} className="text-xs font-medium text-primary hover:underline">
                        Select All Employees
                      </button>
                    </>
                  )}
                  <span className="text-muted-foreground">|</span>
                  <button type="button" onClick={clearAllAssignees} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                    Clear All
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {hasRoleGrouping && filteredManagers.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/50">Managers</p>
                      {filteredManagers.map((member) => {
                        const isSelected = selectedEmployees.includes(member.id);
                        return (
                          <label
                            key={member.id}
                            className={cn(
                              "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                              isSelected ? "bg-primary/10" : "hover:bg-muted/60"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleEmployee(member.id)}
                            />
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (member.full_name || "?").slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {(hasRoleGrouping ? filteredEmployees : projectCreationAssignable.filter((m) => !assigneeSearchLower || m.full_name.toLowerCase().includes(assigneeSearchLower))).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/50">
                        {hasRoleGrouping ? "Employees" : "Team"}
                      </p>
                      {(hasRoleGrouping ? filteredEmployees : projectCreationAssignable.filter((m) => !assigneeSearchLower || m.full_name.toLowerCase().includes(assigneeSearchLower))).map((member) => {
                        const isSelected = selectedEmployees.includes(member.id);
                        return (
                          <label
                            key={member.id}
                            className={cn(
                              "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                              isSelected ? "bg-primary/10" : "hover:bg-muted/60"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleEmployee(member.id)}
                            />
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (member.full_name || "?").slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedEmployees.length > 0 && (
                  <div className="p-2 border-t border-border flex flex-wrap gap-1">
                    {selectedEmployees.map((id) => {
                      const m = projectCreationAssignable.find((u) => u.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-0.5 pl-1.5 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-xs"
                        >
                          {m?.full_name ?? id}
                          <button type="button" onClick={() => removeAssigneeChip(id)} className="p-0.5 hover:bg-primary/20 rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
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
          {projects.map((project) => {
            console.log('[ProjectCard] member_count:', (project as { member_count?: number }).member_count);
            console.log('[ProjectCard] members_preview (as members):', project.members);
            console.log('[ProjectCard] raw project:', JSON.stringify(project, null, 2));
            return (
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
                {(project as { member_count?: number }).member_count ?? project.members.length} member{((project as { member_count?: number }).member_count ?? project.members.length) !== 1 ? "s" : ""}
              </div>

              {/* Member chips */}
              <div className="flex flex-wrap gap-1">
                {project.members.slice(0, 3).map((m) => (
                  <span
                    key={m.id}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {m.full_name}
                  </span>
                ))}
                {project.members.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    +{project.members.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <div className="text-[10px] text-muted-foreground">
                  Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDetailProject(project)}
                >
                  View details
                </Button>
              </div>
            </motion.div>
          );
          })}
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

      {/* Project detail sheet — Members section */}
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
                            <ProjectMemberCard
                              key={m.id}
                              member={m}
                              isCreator={isCreator}
                              myProfileId={myProfileId}
                              onRemove={() => handleRemoveMember(m.id, m.full_name)}
                              onViewProfile={() => window.open(`/profile/${m.user_id}`, "_self")}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {employeesList.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Employees</p>
                        <div className="space-y-2">
                          {employeesList.map((m) => (
                            <ProjectMemberCard
                              key={m.id}
                              member={m}
                              isCreator={isCreator}
                              myProfileId={myProfileId}
                              onRemove={() => handleRemoveMember(m.id, m.full_name)}
                              onViewProfile={() => window.open(`/profile/${m.user_id}`, "_self")}
                            />
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
    </div>
  );
};

function ProjectMemberCard({
  member,
  isCreator,
  myProfileId,
  onRemove,
  onViewProfile,
}: {
  member: ProjectMemberDetail;
  isCreator: boolean;
  myProfileId: string | null;
  onRemove: () => void;
  onViewProfile: () => void;
}) {
  const isSelf = myProfileId && member.id === myProfileId;
  const roleLabel = (member.external_role || "employee").toLowerCase() === "subadmin"
    ? (member.external_sub_role || "Subadmin")
    : (member.external_role || "Employee");
  const roleBadgeClass =
    (member.external_role || "").toLowerCase() === "manager"
      ? "bg-primary/10 text-primary text-[10px]"
      : (member.external_role || "").toLowerCase() === "subadmin"
        ? "bg-orange-500/10 text-orange-600 text-[10px]"
        : "bg-muted text-muted-foreground text-[10px]";
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border border-border bg-card",
        "hover:bg-muted/30 transition-colors"
      )}
    >
      <button type="button" onClick={onViewProfile} className="flex-1 flex items-start gap-3 text-left min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-medium text-primary">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            (member.full_name || "?").slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{member.full_name}</span>
            <span className={cn("px-1.5 py-0.5 rounded-full font-medium", roleBadgeClass)}>{roleLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Added: {member.added_to_project_at ? format(new Date(member.added_to_project_at), "dd MMM yyyy") : "—"}
          </p>
        </div>
      </button>
      {isCreator && !isSelf && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="Remove member"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
