import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  UserMinus,
  ChevronRight,
  Search,
  BarChart3,
  CheckCircle,
  Clock,
  ListTodo,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useTeams,
  useTeamMembers,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAssignToTeam,
  useTeamStats,
  Team,
  TeamMember,
} from "@/hooks/useTeams";
import { db } from "@/integrations/api/db";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  team_id: string | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const TeamManagement = () => {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const assignToTeam = useAssignToTeam();

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [newTeam, setNewTeam] = useState({ name: "", description: "", lead_id: "" });
  const [editTeam, setEditTeam] = useState({ id: "", name: "", description: "", lead_id: "" });

  const { data: teamMembers, isLoading: membersLoading } = useTeamMembers(selectedTeam?.id || null);
  const { data: teamStats } = useTeamStats(selectedTeam?.id || null);

  // Fetch all employees for lead selection and team assignment
  const { data: allEmployees } = useQuery({
    queryKey: ["all-employees-for-teams"],
    queryFn: async () => {
      const response = await db.functions.invoke("admin-manage", {
        body: { action: "get-all-employees" },
      });
      if (response.error) throw response.error;
      return response.data?.employees as Employee[];
    },
  });

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    try {
      await createTeam.mutateAsync({
        name: newTeam.name.trim(),
        description: newTeam.description.trim() || undefined,
        lead_id: newTeam.lead_id || undefined,
      });
      toast.success("Team created successfully!");
      setNewTeam({ name: "", description: "", lead_id: "" });
      setShowCreateForm(false);
    } catch (error) {
      toast.error("Failed to create team");
    }
  };

  const handleUpdateTeam = async () => {
    if (!editTeam.name.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    try {
      await updateTeam.mutateAsync({
        id: editTeam.id,
        name: editTeam.name.trim(),
        description: editTeam.description.trim() || null,
        lead_id: editTeam.lead_id || null,
      });
      toast.success("Team updated successfully!");
      setShowEditForm(false);
      if (selectedTeam?.id === editTeam.id) {
        setSelectedTeam({
          ...selectedTeam,
          name: editTeam.name,
          description: editTeam.description,
          lead_id: editTeam.lead_id || null,
        });
      }
    } catch (error) {
      toast.error("Failed to update team");
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`Are you sure you want to delete "${team.name}"? All members will be unassigned.`)) {
      return;
    }

    try {
      await deleteTeam.mutateAsync(team.id);
      toast.success("Team deleted");
      if (selectedTeam?.id === team.id) {
        setSelectedTeam(null);
      }
    } catch (error) {
      toast.error("Failed to delete team");
    }
  };

  const handleAssignMember = async (employee: Employee) => {
    if (!selectedTeam) return;

    try {
      await assignToTeam.mutateAsync({
        profileId: employee.id,
        teamId: selectedTeam.id,
      });
      toast.success(`${employee.full_name} added to team`);
    } catch (error) {
      toast.error("Failed to assign member");
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    try {
      await assignToTeam.mutateAsync({
        profileId: member.id,
        teamId: null,
      });
      toast.success(`${member.full_name} removed from team`);
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const startEdit = (team: Team) => {
    setEditTeam({
      id: team.id,
      name: team.name,
      description: team.description || "",
      lead_id: team.lead_id || "",
    });
    setShowEditForm(true);
  };

  // Filter employees not in the current team
  const availableEmployees =
    allEmployees?.filter(
      (e) => e.team_id !== selectedTeam?.id && e.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team Management
        </h2>
        <Button onClick={() => setShowCreateForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Team
        </Button>
      </motion.div>

      {/* Create Team Form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Create New Team</h3>
            <button onClick={() => setShowCreateForm(false)}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              placeholder="Team name *"
              className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <textarea
              value={newTeam.description}
              onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <select
              value={newTeam.lead_id}
              onChange={(e) => setNewTeam({ ...newTeam, lead_id: e.target.value })}
              className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Team Lead (optional)</option>
              {allEmployees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} {emp.job_title ? `- ${emp.job_title}` : ""}
                </option>
              ))}
            </select>
            <Button onClick={handleCreateTeam} disabled={createTeam.isPending} className="w-full">
              {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Team"}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams List */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
          <h3 className="font-semibold mb-4">All Teams ({teams?.length || 0})</h3>

          {teamsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    selectedTeam?.id === team.id ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                  }`}
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {team.member_count} member{team.member_count !== 1 ? "s" : ""}
                      {team.lead?.full_name && ` · Lead: ${team.lead.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(team);
                      }}
                      className="p-2 hover:bg-background rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(team);
                      }}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No teams created yet</p>
              <Button onClick={() => setShowCreateForm(true)} variant="outline" className="mt-3">
                Create First Team
              </Button>
            </div>
          )}
        </motion.div>

        {/* Team Details */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
          {selectedTeam ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTeam.name}</h3>
                  {selectedTeam.description && (
                    <p className="text-sm text-muted-foreground">{selectedTeam.description}</p>
                  )}
                </div>
                <Button onClick={() => setShowAssignModal(true)} size="sm" variant="outline">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Team Stats */}
              {teamStats && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{teamStats.memberCount}</p>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <CheckCircle className="w-4 h-4 mx-auto mb-1 text-green-500" />
                    <p className="text-xl font-bold">{teamStats.approvedContributions}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <ListTodo className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                    <p className="text-xl font-bold">{teamStats.activeTasks}</p>
                    <p className="text-xs text-muted-foreground">Active Tasks</p>
                  </div>
                </div>
              )}

              {/* Team Members */}
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Team Members</h4>
              {membersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : teamMembers && teamMembers.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.job_title || member.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Remove from team"
                      >
                        <UserMinus className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No members in this team yet
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
              <p>Select a team to view details</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit Team Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-6 shadow-elevated max-w-md w-full"
          >
            <h3 className="font-semibold mb-4">Edit Team</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={editTeam.name}
                onChange={(e) => setEditTeam({ ...editTeam, name: e.target.value })}
                placeholder="Team name *"
                className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <textarea
                value={editTeam.description}
                onChange={(e) => setEditTeam({ ...editTeam, description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <select
                value={editTeam.lead_id}
                onChange={(e) => setEditTeam({ ...editTeam, lead_id: e.target.value })}
                className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No Team Lead</option>
                {allEmployees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} {emp.job_title ? `- ${emp.job_title}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleUpdateTeam} disabled={updateTeam.isPending} className="flex-1">
                {updateTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Assign Member Modal */}
      {showAssignModal && selectedTeam && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-6 shadow-elevated max-w-md w-full max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Members to {selectedTeam.name}</h3>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {availableEmployees.length > 0 ? (
                availableEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.job_title || emp.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssignMember(emp)}
                      disabled={assignToTeam.isPending}
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {searchQuery ? "No employees found" : "All employees are already assigned to teams"}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={() => setShowAssignModal(false)} className="mt-4">
              Done
            </Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
