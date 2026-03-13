import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Briefcase, IdCard, Building2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

interface MeDetails {
  name: string;
  job_title: string | null;
  employee_code: string | null;
  department: string | null;
  reporting_manager_name: string | null;
}

const OnboardingDetailsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = (user as { userType?: string } | null)?.userType;
  const [details, setDetails] = useState<MeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MeDetails>("/users/me/details")
      .then((res) => {
        if (res.error) {
          setError(res.error.message);
          return;
        }
        if (res.data) setDetails(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading your details...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <p className="text-destructive mb-4">{error || "Failed to load details"}</p>
        <Button variant="outline" onClick={() => navigate("/onboarding")}>
          Go back
        </Button>
      </div>
    );
  }

  const employeeIdDisplay = details.employee_code?.trim() || null;
  const rows = [
    { icon: User, label: "Full Name", value: details.name || "—" },
    { icon: Briefcase, label: "Job Title", value: details.job_title || "—" },
    { icon: IdCard, label: "Employee ID", value: employeeIdDisplay, valueMuted: !employeeIdDisplay },
    { icon: Building2, label: "Department", value: details.department || "—" },
    ...(userType === "SENIOR_MANAGER"
      ? []
      : [{ icon: UserCheck, label: "Reporting Manager", value: details.reporting_manager_name || "Not assigned" }]),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="text-base font-display font-semibold">Your Employee Details</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground">
            Here are your details as registered in our system.
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {rows.map(({ icon: Icon, label, value, valueMuted }) => (
              <div
                key={label}
                className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className={`text-sm font-medium truncate ${valueMuted ? "text-muted-foreground" : ""}`}>
                    {label === "Employee ID" && !value ? "Currently Not Assigned" : (value || "—")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            If any details are incorrect, please contact HR.
          </p>
          <Button
            className="w-full"
            onClick={() => navigate("/complete-profile")}
          >
            Next
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default OnboardingDetailsPage;
