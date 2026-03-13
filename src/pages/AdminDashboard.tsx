import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  UserPlus,
  Users,
  Edit,
  Shield,
  Settings,
  Database,
  Key,
  BarChart3,
  Search,
  Trash2,
  UserCheck,
  Building2,
  MapPin,
  Briefcase,
  UsersRound,
  Bell,
  Globe,
  Send,
  Plus,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/api/db";
import { clearAuth } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TeamManagement } from "@/components/admin/TeamManagement";
import { EmailSettings } from "@/components/admin/EmailSettings";
import { ScrollablePillRow } from "@/components/ui/scrollable-pill-row";
import { NotificationBroadcast } from "@/components/admin/NotificationBroadcast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  manager_id: string | null;
  created_at: string;
  user_roles: { role: string }[] | null;
}

interface Manager {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface Stats {
  totalEmployees: number;
  roleBreakdown: Record<string, number>;
  departmentBreakdown: Record<string, number>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

type TabType = "overview" | "employees" | "teams" | "apiImport" | "notifications" | "settings";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  

  // Stats
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    roleBreakdown: {},
    departmentBreakdown: {},
  });

  // API Import (Postman-like) state
  const [apiUrl, setApiUrl] = useState("");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiHeaders, setApiHeaders] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [apiFetchLoading, setApiFetchLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<unknown>(null);
  const [apiResponseStatus, setApiResponseStatus] = useState<number | null>(null);
  const [dataPath, setDataPath] = useState(""); // e.g. "data" or "data.employees"
  type ParsedEmployee = {
    email: string;
    full_name: string;
    employee_code?: string;
    job_title?: string;
    department?: string;
    employment_type?: string; // raw code: full_time, part_time, contract
    reporting_manager_name?: string;
    reporting_manager_code?: string;
    external_role?: string;
    external_sub_role?: string;
    default_password?: string;
    date_of_joining?: string | null;
    location?: string;
  };
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployee[]>([]);
  const [revealedPasswordIndex, setRevealedPasswordIndex] = useState<number | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importFailedDetails, setImportFailedDetails] = useState<{ email: string; error: string }[]>([]);
  const [conflictModal, setConflictModal] = useState<{ existingEmails: string[]; pendingEmployees: ParsedEmployee[] } | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: { action: "get-all-employees" },
      });

      if (response.error) throw response.error;
      const emps = response.data?.employees || [];
      setEmployees(emps);

      // Calculate stats
      const roleBreakdown: Record<string, number> = {};
      const departmentBreakdown: Record<string, number> = {};

      emps.forEach((emp: Employee) => {
        const role = emp.user_roles?.[0]?.role || "unassigned";
        roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;

        const dept = emp.department || "Unassigned";
        departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1;
      });

      setStats({
        totalEmployees: emps.length,
        roleBreakdown,
        departmentBreakdown,
      });
    } catch (err) {
      console.error("Error fetching employees:", err);
      toast.error("Failed to fetch employees");
    }
  }, []);

  const fetchManagers = useCallback(async () => {
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: { action: "get-managers" },
      });

      if (response.error) throw response.error;
      setManagers(response.data?.managers || []);
    } catch (err) {
      console.error("Error fetching managers:", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEmployees(), fetchManagers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchEmployees, fetchManagers]);

  // API Import: fetch external URL (proxy via backend)
  const handleApiFetch = async () => {
    if (!apiUrl.trim()) {
      toast.error("Enter an API URL");
      return;
    }
    setApiFetchLoading(true);
    setApiResponse(null);
    setApiResponseStatus(null);
    try {
      const headers: Record<string, string> = {};
      apiHeaders.forEach((h) => {
        if (h.key.trim()) headers[h.key.trim()] = h.value.trim();
      });
      const response = await db.functions.invoke("admin-api-fetch", {
        body: { url: apiUrl.trim(), method: apiMethod, headers },
      });
      if (response.error) throw response.error;
      const body = response.data?.body;
      const status = response.data?.status;
      setApiResponse(body);
      setApiResponseStatus(status ?? null);
      if (status && status >= 400) toast.error(`API returned ${status}`);
      else toast.success("Response received");
    } catch (err) {
      console.error("API fetch error:", err);
      toast.error("Failed to fetch URL");
      setApiResponse(null);
    } finally {
      setApiFetchLoading(false);
    }
  };

  // Get value from object by path e.g. "data.employees"
  const getByPath = (obj: unknown, path: string): unknown => {
    if (!path.trim()) return obj;
    const keys = path.trim().split(".").filter(Boolean);
    let cur: unknown = obj;
    for (const k of keys) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur;
  };

  const formatEmploymentType = (raw: string | undefined): string => {
    if (!raw || !String(raw).trim()) return "—";
    const v = String(raw).trim().toLowerCase();
    if (v === "full_time") return "Full Time";
    if (v === "part_time") return "Part Time";
    if (v === "contract") return "Contract";
    return raw;
  };

  const handleParseEmployees = async () => {
    const raw = dataPath.trim() ? getByPath(apiResponse, dataPath) : apiResponse;
    const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && "data" in (raw as object) ? (raw as { data: unknown[] }).data : null;
    const list = Array.isArray(arr) ? arr : raw && typeof raw === "object" ? [raw] : [];
    const mapped: ParsedEmployee[] = list
      .map((item: Record<string, unknown>) => {
        const firstName = String(item.firstName ?? item.first_name ?? "").trim();
        const lastName = String(item.lastName ?? item.last_name ?? "").trim();
        const full_name = `${firstName} ${lastName}`.trim() || (item.full_name ?? item.fullName ?? item.name ?? item.Email ?? item.email ?? "") as string;
        const email = (item.email ?? item.Email ?? item.mail ?? "") as string;
        const designation = (item.designation ?? item.job_title ?? item.jobTitle ?? item.title) as string | undefined;
        const departmentName = (item.departmentName ?? item.department ?? item.Department ?? item.dept) as string | undefined;
        const employmentTypeRaw = (item.employmentType ?? item.employment_type) as string | undefined;
        const reportingManagerName = (item.reportingManagerName ?? item.reporting_manager_name ?? item.reportingManager ?? item.manager ?? item.managerName) as string | null | undefined;
        const reportingManagerCode = (item.reportingManagerId ?? item.reporting_manager_id) as string | null | undefined;
        const externalRole = (item.externalRole ?? item.external_role) as string | undefined;
        const externalSubRole = (item.externalSubRole ?? item.external_sub_role) as string | undefined;
        const defaultPassword = (item.defaultPassword ?? item.default_password) as string | undefined;
        return {
          email,
          full_name: full_name || email.split("@")[0],
          employee_code: (item.employeeCode ?? item.employee_code) as string | undefined,
          job_title: designation?.trim() || undefined,
          department: departmentName?.trim() || undefined,
          employment_type: employmentTypeRaw ? String(employmentTypeRaw).trim().toLowerCase() : undefined,
          reporting_manager_name: reportingManagerName?.trim() || undefined,
          reporting_manager_code: reportingManagerCode?.trim() || undefined,
          external_role: externalRole?.trim() || undefined,
          external_sub_role: externalSubRole?.trim() || undefined,
          default_password: defaultPassword != null ? String(defaultPassword) : undefined,
          date_of_joining: (item.dateOfJoining ?? item.date_of_joining) as string | null | undefined,
          location: (item.location ?? item.Location ?? item.office) as string | undefined,
        };
      })
      .filter((e) => e.email);

    setParsedEmployees(mapped);
    setRevealedPasswordIndex(null);
    if (mapped.length === 0) toast.error("No rows with email found. Check data path or response shape.");
    else toast.success(`Parsed ${mapped.length} employee(s)`);
  };

  const handleSaveToDb = async (onConflict?: "skip" | "overwrite") => {
    const toSave = parsedEmployees.length ? parsedEmployees : [];
    if (!toSave.length) {
      toast.error("No employees to save. Fetch API and parse first.");
      return;
    }
    setImportLoading(true);
    try {
      const response = await db.functions.invoke("admin-import-employees-from-api", {
        body: { employees: toSave, onConflict },
      });
      if (response.error) throw response.error;
      const data = response.data as {
        conflict?: boolean;
        existingEmails?: string[];
        existingCount?: number;
        created?: string[];
        updated?: number;
        skipped?: number;
        failed?: { email: string; error: string }[];
        failedDetails?: { email: string; error: string }[];
        message?: string;
      };
      if (data.conflict && data.existingEmails?.length) {
        setConflictModal({ existingEmails: data.existingEmails, pendingEmployees: toSave });
        setImportFailedDetails([]);
        setImportLoading(false);
        return;
      }
      const created = data.created?.length ?? 0;
      const updated = data.updated ?? 0;
      const skipped = data.skipped ?? 0;
      const failedList = data.failedDetails ?? data.failed ?? [];
      const failed = failedList.length;
      setImportFailedDetails(failedList);
      toast.success(data.message || `Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
      if (created > 0 || updated > 0) fetchEmployees();
      setConflictModal(null);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import employees");
      setImportFailedDetails([]);
    } finally {
      setImportLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirmText !== "RESET") return;
    setResetLoading(true);
    try {
      const response = await db.functions.invoke("admin-reset-database", {
        body: { confirmToken: "RESET_CONFIRMED" },
      });
      if (response.error) throw response.error;
      toast.success("Database cleared. You can now import fresh data.");
      setResetModalOpen(false);
      setResetConfirmText("");
      setTimeout(() => {
        clearAuth();
        navigate("/auth", { replace: true });
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error("Reset database error:", err);
      const msg = (err as { message?: string })?.message ?? (err instanceof Error ? err.message : "Failed to reset database");
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleConflictResolve = (choice: "skip" | "overwrite") => {
    if (!conflictModal) return;
    setImportLoading(true);
    db.functions
      .invoke("admin-import-employees-from-api", {
        body: { employees: conflictModal.pendingEmployees, onConflict: choice },
      })
      .then((response) => {
        if (response.error) throw response.error;
        const data = response.data as { created?: string[]; updated?: number; skipped?: number; failed?: { email: string; error: string }[]; failedDetails?: { email: string; error: string }[]; message?: string };
        const failedList = data.failedDetails ?? data.failed ?? [];
        setImportFailedDetails(failedList);
        toast.success(data.message || "Import completed");
        fetchEmployees();
        setConflictModal(null);
      })
      .catch((err) => {
        console.error("Import error:", err);
        toast.error("Failed to import employees");
      })
      .finally(() => setImportLoading(false));
  };

  const handleUpdateEmployee = async (employeeId: string, updates: Record<string, unknown>) => {
    try {
      const response = await db.functions.invoke("admin-manage", {
        body: {
          action: "update-employee",
          employee_profile_id: employeeId,
          updates,
        },
      });

      if (response.error) throw response.error;

      toast.success("Employee updated successfully");
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      console.error("Error updating employee:", err);
      toast.error("Failed to update employee");
    }
  };

  const roles = ["employee", "team_lead", "manager", "hr", "admin", "organization"];

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery ||
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = !filterRole || emp.user_roles?.[0]?.role === filterRole;

    const matchesDept = !filterDepartment || emp.department === filterDepartment;

    return matchesSearch && matchesRole && matchesDept;
  });

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "employees", label: "Employees", icon: Users },
    { id: "teams", label: "Teams", icon: UsersRound },
    { id: "apiImport", label: "API Import", icon: Globe },
    { id: "notifications", label: "Broadcast", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>

        {/* Tabs — Option C: horizontal scroll with fade edges */}
        <div className="mb-6 pb-2">
          <ScrollablePillRow>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-card hover:bg-muted border border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </ScrollablePillRow>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/10 rounded-xl">
                    <UserCheck className="w-5 h-5 text-green-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.roleBreakdown["admin"] || 0}</p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.roleBreakdown["manager"] || 0}</p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 shadow-soft border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-500/10 rounded-xl">
                    <Building2 className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{departments.length}</p>
                <p className="text-sm text-muted-foreground">Departments</p>
              </motion.div>
            </div>

            {/* Role Distribution */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4">Role Distribution</h3>
              <div className="space-y-3">
                {Object.entries(stats.roleBreakdown).map(([role, count]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize w-24">{role}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(count / stats.totalEmployees) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveTab("employees")}
                  className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                >
                  <UserPlus className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">Add Employee</span>
                </button>
                <button
                  onClick={() => setActiveTab("apiImport")}
                  className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                >
                  <Globe className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">API Import</span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                >
                  <Settings className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">Settings</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            {/* Search & Filter */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </motion.div>

            {/* Employee List */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                All Employees ({filteredEmployees.length})
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No employees found</div>
              ) : (
                <div className="space-y-3">
                  {filteredEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/80 transition-colors cursor-pointer" onClick={() => navigate(`/admin/employees/${emp.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{emp.full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {emp.job_title && (
                            <span className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                              <Briefcase className="w-3 h-3" />
                              {emp.job_title}
                            </span>
                          )}
                          {emp.department && (
                            <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                              <Building2 className="w-3 h-3" />
                              {emp.department}
                            </span>
                          )}
                          {emp.location && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              <MapPin className="w-3 h-3" />
                              {emp.location}
                            </span>
                          )}
                          {emp.user_roles?.[0]?.role && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                              {emp.user_roles[0].role}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingEmployee(emp)}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Teams Tab */}
        {activeTab === "teams" && <TeamManagement />}

        {/* API Import Tab (Postman-like) */}
        {activeTab === "apiImport" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Get Employee Data from Hrms Portal
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter an API URL that returns employee data (JSON). The request is sent via our server to avoid CORS. Then parse the response and save to the database.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select
                  value={apiMethod}
                  onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <input
                  type="url"
                  placeholder="https://api.example.com/employees"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button onClick={handleApiFetch} disabled={apiFetchLoading} className="gap-2">
                  <Send className="w-4 h-4" />
                  {apiFetchLoading ? "Fetching..." : "Send"}
                </Button>
              </div>
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Headers (optional)</p>
                {apiHeaders.map((h, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      placeholder="Key"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...apiHeaders];
                        next[i] = { ...next[i], key: e.target.value };
                        setApiHeaders(next);
                      }}
                      className="w-32 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                    />
                    <input
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...apiHeaders];
                        next[i] = { ...next[i], value: e.target.value };
                        setApiHeaders(next);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setApiHeaders(apiHeaders.filter((_, j) => j !== i))}
                      disabled={apiHeaders.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApiHeaders([...apiHeaders, { key: "", value: "" }])}
                  className="gap-1 mt-1"
                >
                  <Plus className="w-4 h-4" />
                  Add header
                </Button>
              </div>
              {apiResponse !== null && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Response {apiResponseStatus != null && `(${apiResponseStatus})`}
                  </p>
                  <pre className="p-4 rounded-xl bg-muted/50 border border-border text-xs overflow-auto max-h-[240px]">
                    {typeof apiResponse === "string"
                      ? apiResponse
                      : JSON.stringify(apiResponse, null, 2)}
                  </pre>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Data path (e.g. data or data.employees)"
                      value={dataPath}
                      onChange={(e) => setDataPath(e.target.value)}
                      className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                    <Button variant="secondary" onClick={handleParseEmployees} className="gap-1">
                      Parse as employees
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

            {parsedEmployees.length > 0 && (
              <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
                <h3 className="font-semibold mb-4">Parsed employees ({parsedEmployees.length})</h3>
                <div className="overflow-x-auto overflow-y-auto max-h-[320px] border border-border rounded-xl">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Full Name</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Email</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Employee Code</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Job Title</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Department</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Employment Type</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Reporting Manager</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Reporting Manager Code</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Role</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Sub Role</th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">Default Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedEmployees.map((emp, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2 whitespace-nowrap">{emp.full_name}</td>
                          <td className="p-2 whitespace-nowrap">{emp.email}</td>
                          <td className="p-2 whitespace-nowrap">{emp.employee_code ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">{emp.job_title ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">{emp.department ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">
                            {emp.employment_type ? formatEmploymentType(emp.employment_type) : "—"}
                          </td>
                          <td className="p-2 whitespace-nowrap">{emp.reporting_manager_name ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">{emp.reporting_manager_code ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">
                            {emp.external_role ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                                {emp.external_role}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">{emp.external_sub_role ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">
                            {emp.default_password != null && emp.default_password !== "" ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-mono">
                                  {revealedPasswordIndex === i ? emp.default_password : "••••••••"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswordIndex((prev) => (prev === i ? null : i))}
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                  title={revealedPasswordIndex === i ? "Hide" : "Show"}
                                  aria-label={revealedPasswordIndex === i ? "Hide password" : "Show password"}
                                >
                                  {revealedPasswordIndex === i ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  onClick={() => handleSaveToDb()}
                  disabled={importLoading}
                  className="mt-4"
                >
                  {importLoading ? "Saving..." : "Save to database"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  If any of these emails already exist, you will be asked to skip or overwrite.
                </p>
                {importFailedDetails.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
                    <p className="text-sm font-medium text-destructive mb-2">Failed to save ({importFailedDetails.length})</p>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {importFailedDetails.map((f, i) => (
                        <li key={i}>
                          <span className="font-medium">{f.email}</span>: {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                System Settings
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div>
                    <p className="font-medium">Application Name</p>
                    <p className="text-sm text-muted-foreground">MIRROR - Performance Tracking System</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Database Status</p>
                      <p className="text-sm text-muted-foreground">Connected & Healthy</p>
                    </div>
                  </div>
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Authentication</p>
                      <p className="text-sm text-muted-foreground">Email/Password enabled</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Total Users</p>
                      <p className="text-sm text-muted-foreground">{stats.totalEmployees} registered</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Danger Zone */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-destructive/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Reset will delete all data permanently. Only your admin account will be preserved.
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setResetModalOpen(true);
                  setResetConfirmText("");
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset All Data
              </Button>
            </motion.div>

            {/* Role Definitions */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4">Role Permissions</h3>
              <div className="space-y-3">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-medium text-primary">Admin</p>
                  <p className="text-sm text-muted-foreground">Full access to all features, user management, role assignment</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-medium text-blue-500">HR</p>
                  <p className="text-sm text-muted-foreground">View all profiles, manage employee records, access reports</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-medium text-green-500">Manager</p>
                  <p className="text-sm text-muted-foreground">Review team contributions, assign tasks, approve work updates</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-medium text-orange-500">Team Lead</p>
                  <p className="text-sm text-muted-foreground">Lead team activities, review team member work</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-medium">Employee</p>
                  <p className="text-sm text-muted-foreground">Submit work updates, view own tasks and performance</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Tab */}
        {/* Notifications Broadcast Tab */}
        {activeTab === "notifications" && (
          <NotificationBroadcast employees={employees} />
        )}

        {activeTab === "settings" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            {/* System Info */}
            <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
              <h3 className="font-semibold mb-4">System Information</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Application</p>
                      <p className="text-sm text-muted-foreground">MIRROR - Performance Tracking System</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Database Status</p>
                      <p className="text-sm text-muted-foreground">Connected & Healthy</p>
                    </div>
                  </div>
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Authentication</p>
                      <p className="text-sm text-muted-foreground">Email/Password enabled</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Total Users</p>
                      <p className="text-sm text-muted-foreground">{stats.totalEmployees} registered</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Email Settings */}
            <EmailSettings />
          </motion.div>
        )}

        {/* Edit Employee Modal */}
        {editingEmployee && (
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl p-6 shadow-elevated max-w-md w-full"
            >
              <h3 className="font-semibold mb-4">Edit Employee</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    value={editingEmployee.full_name}
                    disabled
                    className="w-full p-3 rounded-xl border border-border bg-muted mt-1 text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Job Title</label>
                  <input
                    type="text"
                    value={editingEmployee.job_title || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, job_title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Department</label>
                  <input
                    type="text"
                    value={editingEmployee.department || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Location</label>
                  <input
                    type="text"
                    value={editingEmployee.location || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, location: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Manager</label>
                  <select
                    value={editingEmployee.manager_id || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, manager_id: e.target.value || null })}
                    className="w-full p-3 rounded-xl border border-border bg-background mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">No Manager</option>
                    {managers
                      .filter((m) => m.id !== editingEmployee.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} {m.job_title ? `- ${m.job_title}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditingEmployee(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    handleUpdateEmployee(editingEmployee.id, {
                      job_title: editingEmployee.job_title,
                      department: editingEmployee.department,
                      location: editingEmployee.location,
                      manager_id: editingEmployee.manager_id,
                    })
                  }
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Conflict resolution: existing employees when importing from API */}
        <Dialog open={!!conflictModal} onOpenChange={(open) => !open && setConflictModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conflict: employees already exist</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {conflictModal?.existingEmails?.length} employee(s) in your import already exist in the database:
            </p>
            <ul className="text-sm list-disc list-inside max-h-32 overflow-y-auto bg-muted/50 rounded-lg p-3">
              {conflictModal?.existingEmails?.slice(0, 20).map((email) => (
                <li key={email}>{email}</li>
              ))}
              {(conflictModal?.existingEmails?.length ?? 0) > 20 && (
                <li className="text-muted-foreground">… and {(conflictModal?.existingEmails?.length ?? 0) - 20} more</li>
              )}
            </ul>
            <p className="text-sm">How do you want to handle them?</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConflictModal(null)} disabled={importLoading}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => handleConflictResolve("skip")} disabled={importLoading}>
                Skip existing
              </Button>
              <Button onClick={() => handleConflictResolve("overwrite")} disabled={importLoading}>
                Overwrite profile data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Database Confirmation Modal */}
        <Dialog open={resetModalOpen} onOpenChange={(open) => !open && !resetLoading && setResetModalOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Reset All Data
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will delete ALL data permanently. Only your admin account will be preserved.
            </p>
            <p className="text-sm font-medium mt-2">Type <strong>RESET</strong> to confirm:</p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full p-3 rounded-xl border border-border bg-background mt-1 font-mono focus:outline-none focus:ring-2 focus:ring-destructive/20"
              autoComplete="off"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setResetModalOpen(false)} disabled={resetLoading}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetDatabase}
                disabled={resetConfirmText !== "RESET" || resetLoading}
              >
                {resetLoading ? "Resetting..." : "Confirm Reset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

export default AdminDashboard;
