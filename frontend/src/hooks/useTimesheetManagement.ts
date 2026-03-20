import { useState, useMemo, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addDays, isAfter, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";
import { api } from "@/integrations/api/client";
import { toast } from "sonner";

/** Calendar date only (YYYY-MM-DD) in local time. Never use toISOString() — it would shift date in UTC. */
function formatDateForApi(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function mapRowToEntry(row: Record<string, unknown>): TimesheetEntry {
  return {
    id: row.id as string,
    date: String(row.date).slice(0, 10),
    workType: (WORK_TYPES.includes((row.work_type as string) as WorkType) ? row.work_type : "Project Work") as WorkType,
    activityTitle: (row.activity_title as string) ?? "",
    projectId: (row.project_id as string) || "",
    projectName: (row.projects as { name?: string } | undefined)?.name || "—",
    taskId: (row.task_id as string) || "",
    taskTitle: (row.tasks as { title?: string } | undefined)?.title || "—",
    hours: Number(row.hours),
    description: (row.description as string) ?? "",
    attachment: (row.attachment_url as string) ?? null,
    createdAt: (row.created_at as string) ?? "",
  };
}

export const WORK_TYPES = [
  "Project Work",
  "Internal Meeting",
  "Learning / Training",
  "Support",
  "Leave",
  "Other",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export interface TimesheetEntry {
  id: string;
  date: string;
  workType: WorkType;
  activityTitle: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  hours: number;
  description: string;
  attachment: string | null;
  createdAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  tasks: { id: string; title: string }[];
}

export type TimesheetStatus = "incomplete" | "submitted" | "approved";

const TARGET_HOURS = 40;
const MAX_DAILY_HOURS = 24;
const MAX_WEEKLY_HOURS = 60;

export const useTimesheetManagement = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [weekStatus, setWeekStatus] = useState<TimesheetStatus>("incomplete");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthEntries, setMonthEntries] = useState<TimesheetEntry[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  // Fetch user's projects with tasks
  const fetchProjects = useCallback(async () => {
    if (!user) return;

    // Get user's profile id
    const { data: profileData } = await db
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const profile = profileData as { id: string } | null | undefined;
    if (!profile?.id) return;

    // Get projects user is a member of
    const { data: membershipsData } = await db
      .from("project_members")
      .select("project_id, projects(id, name)")
      .eq("employee_id", profile.id);

    const memberships = (membershipsData || []) as Record<string, unknown>[];
    if (memberships.length === 0) {
      setProjects([]);
      return;
    }

    const projectOptions: ProjectOption[] = [];
    for (const m of memberships) {
      const proj = m.projects as { id?: string; name?: string } | undefined;
      if (!proj?.id) continue;

      // Get tasks for this project assigned to user
      const { data: tasksData } = await db
        .from("tasks")
        .select("id, title")
        .eq("project_id", proj.id)
        .eq("assigned_to", profile.id)
        .eq("is_deleted", false);

      const tasks = (tasksData || []) as Record<string, unknown>[];
      projectOptions.push({
        id: proj.id,
        name: proj.name ?? "",
        tasks: tasks.map((t) => ({ id: String(t.id), title: String(t.title ?? "") })),
      });
    }

    setProjects(projectOptions);
  }, [user]);

  // Fetch timesheet entries for current week via aggregation API (entries + totals by date)
  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const dateFrom = formatDateForApi(currentWeekStart);
    const dateTo = formatDateForApi(weekEnd);

    const { data, error } = await api.get<{ entries: Record<string, unknown>[]; totalsByDate: Record<string, number> }>(
      "/timesheets/weekly",
      { from: dateFrom, to: dateTo }
    );

    if (error) {
      console.error("Error fetching weekly timesheets:", error);
      setEntries([]);
      return;
    }

    const raw = (data?.entries ?? data) as Record<string, unknown>[] | undefined;
    const list = Array.isArray(raw) ? raw : [];
    setEntries(list.map((row) => mapRowToEntry(row)));
  }, [user, currentWeekStart]);

  // Fetch timesheet entries for a full month via aggregation API (Monthly View)
  const fetchMonthEntries = useCallback(async (month: Date) => {
    if (!user) return;
    const monthNum = month.getMonth() + 1;
    const yearNum = month.getFullYear();
    setMonthLoading(true);
    try {
      const { data, error } = await api.get<{ entries: Record<string, unknown>[]; totalsByDate: Record<string, number> }>(
        "/timesheets/monthly",
        { month: String(monthNum), year: String(yearNum) }
      );

      if (error) {
        console.error("Error fetching month timesheets:", error);
        setMonthEntries([]);
        return;
      }

      const raw = (data?.entries ?? data) as Record<string, unknown>[] | undefined;
      const list = Array.isArray(raw) ? raw : [];
      setMonthEntries(list.map((row) => mapRowToEntry(row)));
    } finally {
      setMonthLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const currentWeekEntries = entries;

  const totalWeeklyHours = useMemo(() => {
    return currentWeekEntries.reduce((sum, e) => sum + e.hours, 0);
  }, [currentWeekEntries]);

  const getDailyHours = (date: Date): number => {
    const dateStr = formatDateForApi(date);
    return currentWeekEntries
      .filter((e) => e.date === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  };

  const getEntriesForDate = (date: Date): TimesheetEntry[] => {
    const dateStr = formatDateForApi(date);
    return currentWeekEntries.filter((e) => e.date === dateStr);
  };

  // Monthly view: all days in selected month
  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const daysInMonth = getDaysInMonth(selectedMonth);
    return Array.from({ length: daysInMonth }, (_, i) => addDays(start, i));
  }, [selectedMonth]);

  const getEntriesForMonthDate = (date: Date): TimesheetEntry[] => {
    const dateStr = formatDateForApi(date);
    return monthEntries.filter((e) => e.date === dateStr);
  };

  const getDailyHoursForMonth = (date: Date): number => {
    const dateStr = formatDateForApi(date);
    return monthEntries
      .filter((e) => e.date === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  };

  const validateEntry = (
    date: Date | undefined,
    workType: WorkType,
    projectId: string,
    taskId: string,
    activityTitle: string,
    hours: number,
    description: string
  ): string | null => {
    if (!date) return "Please select a date.";
    if (isAfter(date, new Date())) return "Cannot log time for future dates.";
    if (hours <= 0) return "Hours must be greater than 0.";
    if (hours > MAX_DAILY_HOURS) return `Cannot log more than ${MAX_DAILY_HOURS} hours per day.`;

    if (workType === "Project Work") {
      if (!projectId) return "Please select a project.";
      if (!taskId) return "Please select a task.";
    } else {
      if (!activityTitle.trim()) return "Please enter an activity title.";
    }

    const dailyTotal = getDailyHours(date) + hours;
    if (dailyTotal > MAX_DAILY_HOURS) return `Total daily hours would exceed ${MAX_DAILY_HOURS}. Currently logged: ${getDailyHours(date)}h.`;

    const weeklyTotal = totalWeeklyHours + hours;
    if (weeklyTotal > MAX_WEEKLY_HOURS) return `Total weekly hours would exceed ${MAX_WEEKLY_HOURS}. Currently logged: ${totalWeeklyHours}h.`;

    return null;
  };

  const addEntry = async (
    date: Date,
    workType: WorkType,
    projectId: string,
    taskId: string,
    activityTitle: string,
    hours: number,
    description: string,
    attachment: string | null
  ) => {
    if (!user) return;

    const payload: Record<string, unknown> = {
      user_id: user.id,
      work_type: workType,
      date: formatDateForApi(date),
      hours,
      description: description || null,
      attachment_url: attachment,
    };
    if (workType === "Project Work") {
      payload.project_id = projectId || null;
      payload.task_id = taskId || null;
      payload.activity_title = null;
    } else {
      payload.project_id = null;
      payload.task_id = null;
      payload.activity_title = activityTitle.trim() || null;
    }

    const { error } = await db.from("timesheets").insert(payload);

    if (error) {
      toast.error(error?.message ?? "Failed to save timesheet entry");
      console.error(error);
      return;
    }

    toast.success("Time entry logged!");
    fetchEntries();
    fetchMonthEntries(selectedMonth);
  };

  const deleteEntry = async (id: string) => {
    if (weekStatus !== "incomplete") return;

    const { error } = await db.from("timesheets").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
      console.error(error);
      return;
    }

    toast.success("Entry deleted");
    fetchEntries();
    fetchMonthEntries(selectedMonth);
  };

  const submitWeeklyTimesheet = () => {
    setWeekStatus("submitted");
    toast.success("Weekly timesheet submitted for review!");
  };

  // Navigate weeks
  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
    setWeekStatus("incomplete");
  };

  const goToPrevWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
    setWeekStatus("incomplete");
  };

  const goToWeekOf = (date: Date) => {
    setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
    setWeekStatus("incomplete");
  };

  return {
    entries: currentWeekEntries,
    weekDays,
    currentWeekStart,
    totalWeeklyHours,
    targetHours: TARGET_HOURS,
    maxWeeklyHours: MAX_WEEKLY_HOURS,
    weekStatus,
    projects,
    getDailyHours,
    getEntriesForDate,
    validateEntry,
    addEntry,
    deleteEntry,
    submitWeeklyTimesheet,
    goToNextWeek,
    goToPrevWeek,
    goToWeekOf,
    selectedMonth,
    setSelectedMonth,
    monthEntries,
    monthDays,
    monthLoading,
    fetchMonthEntries,
    getEntriesForMonthDate,
    getDailyHoursForMonth,
  };
};
