import { useMemo } from "react";
import { motion } from "framer-motion";
import { KanbanCardData } from "./KanbanCard";
import { BarChart3, Users, Clock, CheckCircle, AlertTriangle, Folder, TrendingUp } from "lucide-react";
import { isPast } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectDashboardProps {
  tasks: KanbanCardData[];
}

interface ProjectStat {
  name: string;
  total: number;
  pending: number;
  in_progress: number;
  review: number;
  blocked: number;
  completed: number;
  approved: number;
  overdue: number;
  assignees: Set<string>;
}

export const ProjectDashboard = ({ tasks }: ProjectDashboardProps) => {
  const { overview, projects } = useMemo(() => {
    const total = tasks.length;
    const statuses = { pending: 0, in_progress: 0, review: 0, blocked: 0, completed: 0, approved: 0 };
    let overdue = 0;
    const assignees = new Set<string>();
    const projectMap = new Map<string, ProjectStat>();

    tasks.forEach((t) => {
      const s = (t.status || "pending") as keyof typeof statuses;
      if (s in statuses) statuses[s]++;
      if (t.due_date && isPast(new Date(t.due_date)) && s !== "completed" && s !== "approved") overdue++;
      if (t.assigned_to_name) assignees.add(t.assigned_to_name);

      const pName = t.project_name || "No Project";
      if (!projectMap.has(pName)) {
        projectMap.set(pName, {
          name: pName,
          total: 0, pending: 0, in_progress: 0, review: 0, blocked: 0, completed: 0, approved: 0,
          overdue: 0, assignees: new Set(),
        });
      }
      const p = projectMap.get(pName)!;
      p.total++;
      const ps = s as keyof typeof statuses;
      if (ps in p) (p as Record<string, number>)[ps]++;
      if (t.due_date && isPast(new Date(t.due_date)) && s !== "completed" && s !== "approved") p.overdue++;
      if (t.assigned_to_name) p.assignees.add(t.assigned_to_name);
    });

    return {
      overview: { total, ...statuses, overdue, assigneeCount: assignees.size },
      projects: Array.from(projectMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [tasks]);

  const completionRate = overview.total > 0
    ? Math.round(((overview.completed + overview.approved) / overview.total) * 100)
    : 0;

  const summaryCards = [
    { label: "Total Tasks", value: overview.total, icon: BarChart3, color: "text-primary" },
    { label: "In Progress", value: overview.in_progress, icon: Clock, color: "text-primary" },
    { label: "Completed", value: overview.completed + overview.approved, icon: CheckCircle, color: "text-green-600" },
    { label: "Blocked", value: overview.blocked, icon: AlertTriangle, color: "text-destructive" },
    { label: "Overdue", value: overview.overdue, icon: AlertTriangle, color: "text-destructive" },
    { label: "Team Members", value: overview.assigneeCount, icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-3 border border-border/50 text-center"
            >
              <Icon className={cn("w-5 h-5 mx-auto mb-1", card.color)} />
              <div className="text-xl font-bold">{card.value}</div>
              <div className="text-[10px] text-muted-foreground font-medium">{card.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Completion Rate */}
      <div className="bg-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Overall Completion
          </span>
          <span className="text-sm font-bold">{completionRate}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Per-Project Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Folder className="w-4 h-4 text-primary" /> Project Breakdown
        </h3>
        {projects.map((project, i) => {
          const done = project.completed + project.approved;
          const pct = project.total > 0 ? Math.round((done / project.total) * 100) : 0;

          return (
            <motion.div
              key={project.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-4 border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.total} tasks</span>
              </div>

              {/* Mini progress */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>

              {/* Status chips */}
              <div className="flex flex-wrap gap-1.5">
                {project.pending > 0 && <Chip label="Pending" count={project.pending} className="bg-muted text-muted-foreground" />}
                {project.in_progress > 0 && <Chip label="In Progress" count={project.in_progress} className="bg-primary/10 text-primary" />}
                {project.review > 0 && <Chip label="Review" count={project.review} className="bg-yellow-500/10 text-yellow-600" />}
                {project.blocked > 0 && <Chip label="Blocked" count={project.blocked} className="bg-destructive/10 text-destructive" />}
                {done > 0 && <Chip label="Done" count={done} className="bg-green-500/10 text-green-600" />}
                {project.overdue > 0 && <Chip label="Overdue" count={project.overdue} className="bg-destructive/10 text-destructive" />}
              </div>

              {/* Team */}
              <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <Users className="w-3 h-3" />
                {project.assignees.size} member{project.assignees.size !== 1 ? "s" : ""}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const Chip = ({ label, count, className }: { label: string; count: number; className: string }) => (
  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", className)}>
    {label}: {count}
  </span>
);
