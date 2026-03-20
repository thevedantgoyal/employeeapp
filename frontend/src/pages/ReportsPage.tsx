import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  UserCheck,
  Briefcase,
  Target,
  CalendarDays,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { db } from "@/integrations/api/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

interface RoleStats {
  role: string;
  count: number;
}

interface TaskStats {
  status: string;
  count: number;
}

interface ContributionStats {
  status: string;
  count: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  role: string;
  created_at: string;
}

interface PerformanceData {
  category: string;
  avgScore: number;
}

interface Task {
  status: string | null;
  created_at: string;
}

interface Contribution {
  status: string | null;
  created_at: string;
}

interface PerformanceMetric {
  score: number;
  category_id: string;
  created_at: string;
  metric_categories: { name: string } | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

type DatePreset = "all" | "7d" | "30d" | "this_month" | "last_month" | "custom";

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allContributions, setAllContributions] = useState<Contribution[]>([]);
  const [allMetrics, setAllMetrics] = useState<PerformanceMetric[]>([]);
  const [allRoles, setAllRoles] = useState<{ user_id: string; role: string }[]>([]);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const [profilesRes, rolesRes, tasksRes, contributionsRes, metricsRes] = await Promise.all([
          db.from("profiles").select("id, full_name, email, job_title, department, created_at"),
          db.from("user_roles").select("user_id, role"),
          db.from("tasks").select("status, created_at"),
          db.from("contributions").select("status, created_at"),
          db.from("performance_metrics").select("score, category_id, created_at, metric_categories(name)"),
        ]);

        const profiles = profilesRes.data || [];
        const roles = rolesRes.data || [];
        setAllRoles(roles);

        const membersWithRoles: TeamMember[] = profiles.map((p) => {
          const userRole = roles.find((r) => r.user_id === p.id);
          return {
            ...p,
            role: userRole?.role || "employee",
          };
        });
        setTeamMembers(membersWithRoles);
        setAllTasks(tasksRes.data || []);
        setAllContributions(contributionsRes.data || []);
        setAllMetrics((metricsRes.data as PerformanceMetric[]) || []);
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

  // Calculate effective date range based on preset
  const { effectiveStart, effectiveEnd } = useMemo(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = now;

    switch (datePreset) {
      case "7d":
        start = subDays(now, 7);
        break;
      case "30d":
        start = subDays(now, 30);
        break;
      case "this_month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      }
      case "custom":
        start = startDate;
        end = endDate;
        break;
      case "all":
      default:
        start = undefined;
        end = undefined;
    }

    return { effectiveStart: start, effectiveEnd: end };
  }, [datePreset, startDate, endDate]);

  // Filter helper
  const isInDateRange = (dateStr: string) => {
    if (!effectiveStart && !effectiveEnd) return true;
    try {
      const date = parseISO(dateStr);
      if (effectiveStart && effectiveEnd) {
        return isWithinInterval(date, { start: effectiveStart, end: effectiveEnd });
      }
      if (effectiveStart) return date >= effectiveStart;
      if (effectiveEnd) return date <= effectiveEnd;
      return true;
    } catch {
      return true;
    }
  };

  // Filtered data
  const filteredTasks = useMemo(() => allTasks.filter((t) => isInDateRange(t.created_at)), [allTasks, effectiveStart, effectiveEnd]);
  const filteredContributions = useMemo(() => allContributions.filter((c) => isInDateRange(c.created_at)), [allContributions, effectiveStart, effectiveEnd]);
  const filteredMetrics = useMemo(() => allMetrics.filter((m) => isInDateRange(m.created_at)), [allMetrics, effectiveStart, effectiveEnd]);

  // Calculate stats from filtered data
  const roleStats: RoleStats[] = useMemo(() => {
    const roleCount: Record<string, number> = {};
    allRoles.forEach((r) => {
      roleCount[r.role] = (roleCount[r.role] || 0) + 1;
    });
    return Object.entries(roleCount).map(([role, count]) => ({ role, count }));
  }, [allRoles]);

  const taskStats: TaskStats[] = useMemo(() => {
    const taskCount: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      const status = t.status || "pending";
      taskCount[status] = (taskCount[status] || 0) + 1;
    });
    return Object.entries(taskCount).map(([status, count]) => ({ status, count }));
  }, [filteredTasks]);

  const contributionStats: ContributionStats[] = useMemo(() => {
    const contribCount: Record<string, number> = {};
    filteredContributions.forEach((c) => {
      const status = c.status || "pending";
      contribCount[status] = (contribCount[status] || 0) + 1;
    });
    return Object.entries(contribCount).map(([status, count]) => ({ status, count }));
  }, [filteredContributions]);

  const performanceData: PerformanceData[] = useMemo(() => {
    const perfByCategory: Record<string, { total: number; count: number }> = {};
    filteredMetrics.forEach((m) => {
      const catName = m.metric_categories?.name || "General";
      if (!perfByCategory[catName]) {
        perfByCategory[catName] = { total: 0, count: 0 };
      }
      perfByCategory[catName].total += m.score;
      perfByCategory[catName].count += 1;
    });
    return Object.entries(perfByCategory).map(([category, data]) => ({
      category,
      avgScore: Math.round(data.total / data.count),
    }));
  }, [filteredMetrics]);

  const totalMembers = teamMembers.length;
  const totalTasks = taskStats.reduce((sum, t) => sum + t.count, 0);
  const completedTasks = taskStats.find((t) => t.status === "completed")?.count || 0;
  const totalContributions = contributionStats.reduce((sum, c) => sum + c.count, 0);
  const approvedContributions = contributionStats.find((c) => c.status === "approved")?.count || 0;

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-500/10 text-red-500",
      manager: "bg-blue-500/10 text-blue-500",
      hr: "bg-purple-500/10 text-purple-500",
      team_lead: "bg-amber-500/10 text-amber-500",
      employee: "bg-green-500/10 text-green-500",
      organization: "bg-indigo-500/10 text-indigo-500",
    };
    return colors[role] || "bg-muted text-muted-foreground";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "in_progress":
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "rejected":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const getDateRangeLabel = () => {
    if (datePreset === "all") return "All Time";
    if (datePreset === "7d") return "Last 7 Days";
    if (datePreset === "30d") return "Last 30 Days";
    if (datePreset === "this_month") return "This Month";
    if (datePreset === "last_month") return "Last Month";
    if (datePreset === "custom" && startDate && endDate) {
      return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
    }
    return "Select Range";
  };

  if (loading) {
    return <ConnectPlusLoader variant="inline" message="Loading reports..." />;
  }

  return (
    <>

        {/* Date Filter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 shadow-soft border border-border/50 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Date Range</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "7d", "30d", "this_month", "last_month"] as DatePreset[]).map((preset) => (
              <Button
                key={preset}
                variant={datePreset === preset ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange(preset)}
                className="text-xs"
              >
                {preset === "all" && "All Time"}
                {preset === "7d" && "7 Days"}
                {preset === "30d" && "30 Days"}
                {preset === "this_month" && "This Month"}
                {preset === "last_month" && "Last Month"}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={datePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                >
                  {datePreset === "custom" && startDate && endDate
                    ? `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`
                    : "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Start Date</p>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setDatePreset("custom");
                      }}
                      initialFocus
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">End Date</p>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        setDatePreset("custom");
                      }}
                      disabled={(date) => (startDate ? date < startDate : false)}
                      className={cn("pointer-events-auto")}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {effectiveStart && effectiveEnd && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing data from {format(effectiveStart, "MMM d, yyyy")} to {format(effectiveEnd, "MMM d, yyyy")}
            </p>
          )}
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <motion.div
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalMembers}</p>
            <p className="text-sm text-muted-foreground">Total Staff</p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{totalTasks}</p>
            <p className="text-sm text-muted-foreground">Tasks</p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="bg-card rounded-2xl p-5 shadow-soft border border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold">{totalContributions}</p>
            <p className="text-sm text-muted-foreground">Contributions</p>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-card">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Role Distribution */}
            <motion.div
              variants={itemVariants}
              className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Role Distribution
              </h3>
              <div className="space-y-3">
                {roleStats.map(({ role, count }) => (
                  <div key={role} className="flex items-center gap-3">
                    <Badge className={`capitalize ${getRoleColor(role)}`}>{role}</Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(count / totalMembers) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Task & Contribution Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <motion.div
                variants={itemVariants}
                className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
              >
                <h3 className="font-semibold mb-4">Task Status</h3>
                {taskStats.length > 0 ? (
                  <div className="space-y-3">
                    {taskStats.map(({ status, count }) => (
                      <div key={status} className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <span className="text-sm capitalize flex-1">{status.replace("_", " ")}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tasks in this period</p>
                )}
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
              >
                <h3 className="font-semibold mb-4">Contribution Status</h3>
                {contributionStats.length > 0 ? (
                  <div className="space-y-3">
                    {contributionStats.map(({ status, count }) => (
                      <div key={status} className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <span className="text-sm capitalize flex-1">{status}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contributions in this period</p>
                )}
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {teamMembers.map((member) => (
                <motion.div
                  key={member.id}
                  variants={itemVariants}
                  className="bg-card rounded-xl p-4 shadow-soft border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      {member.job_title && (
                        <p className="text-xs text-muted-foreground mt-1">{member.job_title}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge className={`capitalize ${getRoleColor(member.role)}`}>
                        {member.role}
                      </Badge>
                      {member.department && (
                        <p className="text-xs text-muted-foreground mt-1">{member.department}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <motion.div
              variants={itemVariants}
              className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
            >
              <h3 className="font-semibold mb-4">Task Completion Rate</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="text-sm font-medium">
                    {completedTasks} / {totalTasks}
                  </span>
                </div>
                <Progress
                  value={totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}
                  className="h-3"
                />
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-card rounded-2xl p-6 shadow-soft border border-border/50"
            >
              <h3 className="font-semibold mb-4">Contribution Approval Rate</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Approved</span>
                  <span className="text-sm font-medium">
                    {approvedContributions} / {totalContributions}
                  </span>
                </div>
                <Progress
                  value={
                    totalContributions > 0 ? (approvedContributions / totalContributions) * 100 : 0
                  }
                  className="h-3"
                />
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {performanceData.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {performanceData.map(({ category, avgScore }) => (
                  <motion.div
                    key={category}
                    variants={itemVariants}
                    className="bg-card rounded-xl p-4 shadow-soft border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{category}</span>
                      <span className="text-lg font-bold text-primary">{avgScore}/100</span>
                    </div>
                    <Progress value={avgScore} className="h-2" />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No performance data available for this period</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
    </>
  );
};

export default ReportsPage;
