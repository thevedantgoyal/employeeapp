import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { db } from "@/integrations/api/db";
import { Button } from "@/components/ui/button";
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
  working_status: string;
  user_roles: { role: string }[];
}

interface Manager {
  id: string;
  full_name: string;
  job_title: string | null;
  user_id: string;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const roles = ["employee", "team_lead", "manager", "hr", "admin"];

const AdminEmployeeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [reportingManagerOptions, setReportingManagerOptions] = useState<Manager[]>([]); // other managers only (when viewing a manager)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editRole, setEditRole] = useState("");

  // Password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

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
        setEditDepartment(emp.department || "");
        setEditLocation(emp.location || "");
        setEditManagerId(emp.manager_id || "");
        setEditRole(emp.user_roles?.[0]?.role || "employee");
        if (emp.user_roles?.[0]?.role === "manager") {
          const res = await db.functions.invoke("admin-manage", {
            body: { action: "get-managers", role: "manager", exclude_profile_id: emp.id },
          });
          if (!res.error && res.data?.managers) setReportingManagerOptions(res.data.managers as Manager[]);
          else setReportingManagerOptions([]);
        } else {
          setReportingManagerOptions([]);
        }
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEmployee(), fetchManagers()]);
      setLoading(false);
    };
    load();
  }, [fetchEmployee, fetchManagers]);

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
          },
        },
      });
      if (response.error) throw response.error;

      // Update role if changed
      const currentRole = employee.user_roles?.[0]?.role;
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

  // Show Reporting Manager for employees/team_lead/hr (report to any manager) and for managers (report to another manager)
  const showManagerSelect = editRole === "employee" || editRole === "team_lead" || editRole === "hr" || editRole === "manager";

  // For manager role: only other managers. For others: all managers except self.
  const availableManagers =
    editRole === "manager" ? reportingManagerOptions : managers.filter((m) => m.id !== employee?.id);

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
        <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full capitalize">
          {employee.user_roles?.[0]?.role || "employee"}
        </span>
      </div>

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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Department
            </label>
            <input
              type="text"
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
              placeholder="Enter department"
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

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
                // Clear manager if role is manager/admin
                if (["manager", "admin"].includes(e.target.value)) {
                  setEditManagerId("");
                }
              }}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {showManagerSelect && (
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Reporting Manager
              </label>
              <select
                value={editManagerId}
                onChange={(e) => setEditManagerId(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No Manager</option>
                {availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} {m.job_title ? `- ${m.job_title}` : ""}
                  </option>
                ))}
              </select>
              {editRole === "manager" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty if this manager has no reporting manager (e.g. CEO, CTO, Director).
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
    </div>
  );
};

export default AdminEmployeeDetailPage;
