import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Briefcase,
  Building2,
  MapPin,
  Shield,
  Calendar,
  Key,
  Save,
  Loader2,
  UserCheck,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  Folder,
  Clock,
  CalendarCheck,
  ListTodo,
} from "lucide-react";
import { db } from "@/integrations/api/db";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { z } from "zod";

interface EmployeeDetail {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  manager_id: string | null;
  manager_name: string | null;
  created_at: string;
  status: string | null;
  working_status: string;
  user_roles: { role: string }[];
  external_role?: string | null;
  assigned_task_template_ids?: string[] | null;
}

const DEPARTMENT_DISPLAY_NAMES: Record<string, string> = {
  "Data&Ai": "Data & AI",
  "Cybersecurity": "Cybersecurity",
  "Security": "Cybersecurity",
  "IT Help Desk": "IT Help Desk",
  SCM: "Supply Chain Management (SCM)",
  HR: "Human Resources",
};
function departmentLabel(dept: string): string {
  return DEPARTMENT_DISPLAY_NAMES[dept] ?? dept;
}

function normalizeDepartmentValue(dept: string | null | undefined): string {
  const raw = (dept || "").trim();
  const key = raw.toLowerCase();
  if (["data&ai", "data & ai", "data and ai", "ai"].includes(key)) return "Data&Ai";
  if (["security", "cyber security", "cybersecurity"].includes(key)) return "Cybersecurity";
  if (["it help desk", "it helpdesk", "it support"].includes(key)) return "IT Help Desk";
  if (["human resource", "human resources", "hr"].includes(key)) return "HR";
  return raw;
}

interface Manager {
  id: string;
  full_name: string;
  job_title: string | null;
  user_id: string;
}

interface AssignableManager extends Manager {
  avatar_url?: string | null;
  employee_code?: string | null;
  external_role?: string | null;
  external_sub_role?: string | null;
}

interface WorkStatsData {
  attendance: {
    present_days: number;
    working_days: number;
    rate_percent: number;
    this_week: { day: string; check_in_time: string | null; check_out_time: string | null; hours_worked: number | null }[];
  };
  work_hours: { total_hours: number; daily_avg: number; days_worked: number };
  leave_balances: { name: string; color: string; total_days: number; used_days: number; remaining_days: number }[];
  tasks: { completed: number; pending: number; in_progress: number; in_review: number; total: number };
}

interface ProjectCardData {
  id: string;
  title: string;
  description: string | null;
  project_type: string;
  due_date: string | null;
  created_at: string;
  status: string;
  total_members: number;
  created_by_name: string | null;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const ROLE_OPTIONS = [
  { value: "subadmin", label: "Senior Manager" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
] as const;

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function roleLabel(role: string | null | undefined): string {
  if (role === "subadmin") return "Senior Manager";
  if (role === "manager") return "Manager";
  return "Employee";
}

type DetailTab = "details" | "workStats" | "projects";

const AdminEmployeeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DetailTab>("details");
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [assignableManagers, setAssignableManagers] = useState<AssignableManager[]>([]);
  const [reportingManagerOptions, setReportingManagerOptions] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Work Stats (loaded when tab is active)
  const [workStats, setWorkStats] = useState<WorkStatsData | null>(null);
  const [workStatsLoading, setWorkStatsLoading] = useState(false);
  // Projects (loaded when tab is active)
  const [employeeProjects, setEmployeeProjects] = useState<ProjectCardData[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Edit state
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmploymentStatus, setEditEmploymentStatus] = useState("active");
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [deptTemplates, setDeptTemplates] = useState<{ id: string; task_title: string }[]>([]);
  const [loadingDeptTemplates, setLoadingDeptTemplates] = useState(false);
  const [editTemplateIds, setEditTemplateIds] = useState<string[]>([]);

  // Password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Reporting Manager dropdown (styled)
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");

  const fetchEmployee = useCallback(async () => {
    if (!id) return;
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: { action: "get-employee", employee_profile_id: id },
      });
      if (response.error) throw response.error;
      const emp = response.data?.employee as EmployeeDetail | undefined;
      if (emp) {
        setEmployee(emp);
        setEditJobTitle(emp.job_title || "");
        setEditDepartment(normalizeDepartmentValue(emp.department));
        setEditLocation(emp.location || "");
        setEditManagerId(emp.manager_id || "");
        setEditRole((emp.external_role || "employee").toLowerCase());
        setEditEmploymentStatus((emp.status || "active").toLowerCase() === "inactive" ? "inactive" : "active");
        const tid = emp.assigned_task_template_ids;
        setEditTemplateIds(Array.isArray(tid) ? [...tid] : []);
        const res = await db.functions.invoke("admin-manage", {
          body: { action: "get-assignable-managers", exclude_profile_id: emp.id },
        });
        if (!res.error && res.data?.managers) setAssignableManagers((res.data.managers as AssignableManager[]) || []);
        else setAssignableManagers([]);
      }
    } catch (err) {
      console.error("Error fetching employee:", err);
      toast.error("Failed to load employee details");
    }
  }, [id]);

  const fetchManagers = useCallback(async () => {
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: { action: "get-managers" },
      });
      if (response.error) throw response.error;
      setManagers((response.data?.managers as Manager[]) || []);
    } catch (err) {
      console.error("Error fetching managers:", err);
    }
  }, []);

  const fetchWorkStats = useCallback(async (userId: string) => {
    setWorkStatsLoading(true);
    try {
      const res = await api.get<WorkStatsData>(`/admin/employees/${userId}/stats`);
      if (res.error) throw res.error;
      setWorkStats(res.data ?? null);
    } catch {
      setWorkStats(null);
      toast.error("Failed to load work stats");
    } finally {
      setWorkStatsLoading(false);
    }
  }, []);

  const fetchEmployeeProjects = useCallback(async (userId: string) => {
    setProjectsLoading(true);
    try {
      const res = await api.get<{ projects?: ProjectCardData[] }>(`/admin/employees/${userId}/projects`);
      const data = res.data;
      const projects = data?.projects ?? [];
      console.log("[AdminEmployeeProjects] employeeId (userId):", userId);
      console.log("[AdminEmployeeProjects] API response:", data);
      console.log("[AdminEmployeeProjects] projects count:", projects?.length ?? 0);
      setEmployeeProjects(projects);
    } catch {
      setEmployeeProjects([]);
      toast.error("Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEmployee(), fetchManagers()]);
      setLoading(false);
    };
    load();
  }, [fetchEmployee, fetchManagers]);

  useEffect(() => {
    let cancelled = false;
    api.get<string[]>("/tasks/departments").then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setDeptOptions([...new Set(data.map((d) => normalizeDepartmentValue(d)))]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const d = normalizeDepartmentValue(editDepartment);
    if (!d) {
      setDeptTemplates([]);
      return;
    }
    let cancelled = false;
    setLoadingDeptTemplates(true);
    api
      .get<{ id: string; task_title: string }[]>(`/tasks/templates/${encodeURIComponent(d)}`)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingDeptTemplates(false);
        if (error || !data) {
          setDeptTemplates([]);
          return;
        }
        setDeptTemplates(data);
        setEditTemplateIds((prev) => prev.filter((id) => data.some((t) => t.id === id)));
      });
    return () => {
      cancelled = true;
    };
  }, [editDepartment]);

  useEffect(() => {
    if (activeTab === "workStats" && employee?.user_id) fetchWorkStats(employee.user_id);
  }, [activeTab, employee?.user_id, fetchWorkStats]);

  useEffect(() => {
    if (activeTab === "projects" && employee?.user_id) fetchEmployeeProjects(employee.user_id);
  }, [activeTab, employee?.user_id, fetchEmployeeProjects]);

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      // Update profile details
      const response = await db.functions.invoke("admin-manage", {
        body: {
          action: "update-employee",
          employee_profile_id: employee.id,
          updates: {
            job_title: editJobTitle || null,
            department: editDepartment || null,
            location: editLocation || null,
            manager_id: editManagerId || null,
            status: editEmploymentStatus,
            assigned_task_template_ids: editTemplateIds,
          },
        },
      });
      if (response.error) throw response.error;

      // Update role if changed
      const currentRole = (employee.external_role || "employee").toLowerCase();
      if (editRole !== currentRole) {
        const roleResponse = await db.functions.invoke("admin-manage", {
          body: {
            action: "assign-role",
            user_id: employee.user_id,
            role: editRole,
          },
        });
        if (roleResponse.error) throw roleResponse.error;
      }

      toast.success("Employee updated successfully");
      await fetchEmployee();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Error updating employee:", err);
      toast.error(errorMsg || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (!employee) return;
    setResettingPassword(true);
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: {
          action: "reset-password",
          user_id: employee.user_id,
          new_password: newPassword,
        },
      });
      if (response.error) throw response.error;

      toast.success("Password reset successfully");
      setNewPassword("");
      setShowPasswordReset(false);
    } catch (err) {
      console.error("Error resetting password:", err);
      toast.error("Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const showManagerSelect = editRole === "employee" || editRole === "manager";

  const deptSelectOptions = useMemo(() => {
    const normalizedCurrent = normalizeDepartmentValue(editDepartment);
    if (normalizedCurrent && !deptOptions.includes(normalizedCurrent)) {
      return [...deptOptions, normalizedCurrent].sort();
    }
    return deptOptions;
  }, [deptOptions, editDepartment]);

  const groupedAssignableManagers = useMemo(() => {
    const er = (m: AssignableManager) => (m.external_role || "").toString().trim().toLowerCase();
    const subSet = (m: AssignableManager) => m.external_sub_role != null && String(m.external_sub_role).trim() !== "";
    const senior = assignableManagers.filter((m) => er(m) === "subadmin" || subSet(m));
    const regular = assignableManagers.filter((m) => er(m) === "manager" && !subSet(m));
    return { seniorManagers: senior, managers: regular };
  }, [assignableManagers]);

  const selectedManager = useMemo(
    () => assignableManagers.find((m) => m.id === editManagerId),
    [assignableManagers, editManagerId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Employee not found</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-muted rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{employee.full_name}</h1>
          <p className="text-sm text-muted-foreground">{employee.email}</p>
        </div>
        <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
          {roleLabel(employee.external_role)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "details" ? "bg-card shadow border border-border text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workStats")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "workStats" ? "bg-card shadow border border-border text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Work Stats
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "projects" ? "bg-card shadow border border-border text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Projects
        </button>
      </div>

      {/* Tab: Details */}
      {activeTab === "details" && (
      <>
      {/* Info Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-6 shadow-soft border border-border/50 space-y-5"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Employee Details
        </h3>

        {/* Read-only fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <div className="p-3 rounded-xl border border-border bg-muted text-sm text-muted-foreground">
              {employee.email}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Joined
            </label>
            <div className="p-3 rounded-xl border border-border bg-muted text-sm text-muted-foreground">
              {new Date(employee.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Job Title
            </label>
            <input
              type="text"
              value={editJobTitle}
              onChange={(e) => setEditJobTitle(e.target.value)}
              placeholder="Enter job title"
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Department
            </label>
            <select
              value={editDepartment}
              onChange={(e) => {
                setEditDepartment(e.target.value);
                setEditTemplateIds([]);
              }}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select department</option>
              {deptSelectOptions.map((d) => (
                <option key={d} value={d}>
                  {departmentLabel(d)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Departments match task templates (e.g. seeded in dept_task_templates).
            </p>
          </div>

          {editDepartment.trim() ? (
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5" /> Allowed task templates
              </label>
              {loadingDeptTemplates ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading templates…
                </div>
              ) : deptTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 rounded-xl border border-border">
                  No templates for this department. Add rows in Task Templates or seed dept_task_templates.
                </p>
              ) : (
                <div className="rounded-xl border border-border divide-y divide-border max-h-48 overflow-y-auto">
                  {deptTemplates.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={editTemplateIds.includes(t.id)}
                        onCheckedChange={(checked) => {
                          setEditTemplateIds((prev) =>
                            checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)
                          );
                        }}
                      />
                      <span className="text-sm">{t.task_title}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Leave none selected to allow all templates for this department when creating tasks.
              </p>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Enter location"
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Role
            </label>
            <select
              value={editRole}
              onChange={(e) => {
                setEditRole(e.target.value);
                if (e.target.value === "subadmin") {
                  setEditManagerId("");
                }
              }}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Assignment Status
            </label>
            <select
              value={editEmploymentStatus}
              onChange={(e) => setEditEmploymentStatus(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Inactive users will not appear in task assignee lists during creation or allocation.
            </p>
          </div>

          {showManagerSelect && (
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Reporting Manager
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setManagerDropdownOpen((o) => !o)}
                  className="w-full p-3 rounded-xl border border-border bg-background text-left flex items-center gap-3 hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {selectedManager ? (
                    <>
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {selectedManager.avatar_url?.trim() ? (
                          <img src={selectedManager.avatar_url.trim()} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-primary">
                            {(selectedManager.full_name || "?").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedManager.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedManager.job_title || ""}
                          {selectedManager.employee_code ? ` · ${selectedManager.employee_code}` : ""}
                        </p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${managerDropdownOpen ? "rotate-180" : ""}`} />
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">Select manager...</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform ${managerDropdownOpen ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>
                {managerDropdownOpen && (
                  <>
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden" style={{ minWidth: "280px" }}>
                      <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50">
                          <Search className="w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search manager..."
                            value={managerSearch}
                            onChange={(e) => setManagerSearch(e.target.value)}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {(() => {
                          const q = managerSearch.trim().toLowerCase();
                          const filter = (m: AssignableManager) =>
                            !q || m.full_name?.toLowerCase().includes(q) || m.job_title?.toLowerCase().includes(q) || m.employee_code?.toLowerCase().includes(q);
                          const senior = groupedAssignableManagers.seniorManagers.filter(filter);
                          const regular = groupedAssignableManagers.managers.filter(filter);
                          const hasAny = senior.length > 0 || regular.length > 0;
                          return !hasAny ? (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">No managers found</p>
                          ) : (
                            <>
                              {senior.length > 0 && (
                                <div className="px-2 py-1">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">Senior Managers</p>
                                  {senior.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setEditManagerId(m.id);
                                        setManagerDropdownOpen(false);
                                        setManagerSearch("");
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${editManagerId === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                        {m.avatar_url?.trim() ? (
                                          <img src={m.avatar_url.trim()} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[10px] font-semibold text-muted-foreground">
                                            {(m.full_name || "?").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{m.job_title || m.external_sub_role || "—"}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {regular.length > 0 && (
                                <div className="px-2 py-1">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">Managers</p>
                                  {regular.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setEditManagerId(m.id);
                                        setManagerDropdownOpen(false);
                                        setManagerSearch("");
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${editManagerId === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                        {m.avatar_url?.trim() ? (
                                          <img src={m.avatar_url.trim()} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[10px] font-semibold text-muted-foreground">
                                            {(m.full_name || "?").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{m.job_title || "—"}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="p-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => {
                            setEditManagerId("");
                            setManagerDropdownOpen(false);
                            setManagerSearch("");
                          }}
                          className="w-full text-sm text-muted-foreground hover:text-foreground py-1.5"
                        >
                          No Manager
                        </button>
                      </div>
                    </div>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setManagerDropdownOpen(false)} />
                  </>
                )}
              </div>
              {editRole === "subadmin" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Senior Managers should normally have no reporting manager.
                </p>
              )}
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </motion.div>

      {/* Password Reset Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl p-6 shadow-soft border border-border/50 space-y-4"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          Password Management
        </h3>

        {!showPasswordReset ? (
          <Button variant="outline" onClick={() => setShowPasswordReset(true)}>
            Reset Password
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-3 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min 8 characters, 1 uppercase letter, 1 number
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordReset(false);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resettingPassword || !newPassword}
              >
                {resettingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirm Reset"
                )}
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Status & Activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
      >
        <h3 className="font-semibold mb-4">Status</h3>
        <div className="flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${
              employee.working_status === "available"
                ? "bg-green-500"
                : employee.working_status === "busy"
                ? "bg-orange-500"
                : "bg-muted-foreground"
            }`}
          />
          <span className="text-sm capitalize">{employee.working_status}</span>
        </div>
      </motion.div>
      </>
      )}

      {/* Tab: Work Stats */}
      {activeTab === "workStats" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {workStatsLoading ? (
            <div className="bg-card rounded-2xl p-8 border border-border/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading work stats...</p>
            </div>
          ) : workStats ? (
            <>
              {/* Section 1 — Attendance */}
              <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-primary" />
                  Attendance Rate
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                {workStats.attendance.working_days === 0 ? (
                  <p className="text-sm text-muted-foreground">No attendance data recorded</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4 flex-wrap mb-2">
                      <div className="text-4xl font-bold text-primary">{workStats.attendance.rate_percent}%</div>
                      <div className="flex-1 min-w-[120px] h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${workStats.attendance.rate_percent}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {workStats.attendance.present_days} / {workStats.attendance.working_days} working days
                    </p>
                  </>
                )}
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">This week</p>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="text-left p-2 font-medium">Day</th>
                          <th className="text-left p-2 font-medium">Check In</th>
                          <th className="text-left p-2 font-medium">Check Out</th>
                          <th className="text-left p-2 font-medium">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!workStats.attendance.this_week?.length ? (
                          <tr><td colSpan={4} className="p-4 text-muted-foreground text-center">No data this week</td></tr>
                        ) : (
                          workStats.attendance.this_week.map((row) => (
                            <tr key={row.day} className="border-b border-border/50 last:border-0">
                              <td className="p-2">{dayNames[new Date(row.day).getDay()]} {new Date(row.day).getDate()}</td>
                              <td className="p-2">{row.check_in_time ?? "—"}</td>
                              <td className="p-2">{row.check_out_time ?? "—"}</td>
                              <td className="p-2">{row.hours_worked != null ? `${row.hours_worked}h` : "Absent"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Section 2 — Work Hours */}
              <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Work hours (this month)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-2xl font-bold">{workStats.work_hours.total_hours}h</p>
                    <p className="text-xs text-muted-foreground">Total hours</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-2xl font-bold">{workStats.work_hours.daily_avg}h</p>
                    <p className="text-xs text-muted-foreground">Daily avg</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{workStats.work_hours.days_worked} days worked</p>
              </div>

              {/* Section 3 — Leave */}
              <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
                <h3 className="font-semibold mb-4">Leave balances</h3>
                {!workStats.leave_balances?.length ? (
                  <p className="text-sm text-muted-foreground">No leave data available</p>
                ) : (
                  <div className="space-y-4">
                    {workStats.leave_balances.map((lb) => {
                      const pct = lb.total_days ? (lb.used_days / lb.total_days) * 100 : 0;
                      return (
                        <div key={lb.name}>
                          <p className="text-sm font-medium mb-1">{lb.name}</p>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: lb.color || "hsl(var(--primary))" }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {lb.used_days}/{lb.total_days} used · {lb.remaining_days} days remaining
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4 — Tasks */}
              <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary" />
                  Tasks
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-xl font-bold text-green-600">{workStats.tasks.completed}</p>
                    <p className="text-xs text-muted-foreground">Done</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                    <p className="text-xl font-bold text-amber-600">{workStats.tasks.pending}</p>
                    <p className="text-xs text-muted-foreground">Pend.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                    <p className="text-xl font-bold text-blue-600">{workStats.tasks.in_progress}</p>
                    <p className="text-xs text-muted-foreground">In prog.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                    <p className="text-xl font-bold text-purple-600">{workStats.tasks.in_review}</p>
                    <p className="text-xs text-muted-foreground">Review</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-2xl p-8 border border-border/50 text-center text-muted-foreground">
              No work stats available
            </div>
          )}
        </motion.div>
      )}

      {/* Tab: Projects */}
      {activeTab === "projects" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {projectsLoading ? (
            <div className="bg-card rounded-2xl p-8 border border-border/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          ) : employeeProjects.length === 0 ? (
            <div className="bg-card rounded-2xl p-12 border border-border/50 flex flex-col items-center justify-center gap-3 text-center">
              <Folder className="w-12 h-12 text-muted-foreground" />
              <p className="font-medium">Not assigned to any projects</p>
              <p className="text-sm text-muted-foreground">Projects this employee is part of will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employeeProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-card rounded-2xl p-4 shadow-soft border border-border/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{proj.title}</h4>
                        {proj.description && <p className="text-xs text-muted-foreground line-clamp-1">{proj.description}</p>}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        proj.project_type === "client"
                          ? "bg-blue-500/10 text-blue-600"
                          : proj.project_type === "inhouse" || proj.project_type === "in-house"
                          ? "bg-purple-500/10 text-purple-600"
                          : "bg-green-500/10 text-green-600"
                      }`}
                    >
                      {proj.project_type === "client" ? "Client" : proj.project_type === "inhouse" || proj.project_type === "in-house" ? "In-house" : "Internal"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {proj.due_date && (
                      <span>Due: {new Date(proj.due_date).toLocaleDateString()}</span>
                    )}
                    <span>{proj.total_members} members</span>
                    {proj.created_by_name && <span>Created by: {proj.created_by_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminEmployeeDetailPage;
