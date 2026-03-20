import { useState, useEffect, useMemo } from "react";
import {
  X,
  Users,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/integrations/api/client";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";

export type WorkloadLevel = "light" | "moderate" | "heavy";

export type AssignableEmployee = {
  id: string;
  user_id: string;
  full_name: string;
  job_title?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  employee_code?: string | null;
};

type WorkloadTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  task_date?: string | null;
  duration_hours?: number | null;
};

function formatTaskDurationHours(h: number | null | undefined): string | null {
  if (h == null || !(Number(h) > 0)) return null;
  const n = Number(h);
  const hh = Math.floor(n);
  const mm = Math.round((n - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

type WorkloadItem = {
  user_id: string;
  profile_id: string | null;
  pending_count: number;
  in_progress_count: number;
  overdue_count: number;
  due_this_week_count: number;
  active_count: number;
  workload_level: WorkloadLevel;
  tasks_this_month: WorkloadTask[];
  hours_booked_today?: number;
  hours_booked_this_week?: number;
};

type SortOption = "lightest" | "heaviest" | "az";

const WORKLOAD_COLORS: Record<WorkloadLevel, string> = {
  light: "bg-emerald-500",
  moderate: "bg-amber-500",
  heavy: "bg-red-500",
};

const WORKLOAD_BADGE: Record<WorkloadLevel, string> = {
  light: "bg-emerald-500/10 text-emerald-600",
  moderate: "bg-amber-500/10 text-amber-600",
  heavy: "bg-red-500/10 text-red-600",
};

interface WorkloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignableEmployees: AssignableEmployee[];
  initialSelectedProfileIds: string[];
  onAssignSelected: (profileIds: string[], workloadMap: Record<string, WorkloadLevel>) => void;
  title?: string;
}

export function WorkloadModal({
  open,
  onOpenChange,
  assignableEmployees,
  initialSelectedProfileIds,
  onAssignSelected,
  title = "Team Workload",
}: WorkloadModalProps) {
  const [tab, setTab] = useState<"workload" | "calendar">("workload");
  const [sort, setSort] = useState<SortOption>("lightest");
  const [month, setMonth] = useState(() => new Date());
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [workloadData, setWorkloadData] = useState<WorkloadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const userIds = useMemo(() => {
    const raw = assignableEmployees.map((e) => (typeof e === "string" ? e : e.user_id)).filter(Boolean) as string[];
    const clean = raw.filter(
      (id) =>
        id &&
        id !== "undefined" &&
        id !== "null" &&
        String(id).length === 36
    );
    if (typeof window !== "undefined" && assignableEmployees.length > 0) {
      console.log("[WorkloadModal] props assignableEmployees count:", assignableEmployees.length);
      console.log("[WorkloadModal] first employee:", assignableEmployees[0]);
      console.log("[WorkloadModal] userIds raw:", raw);
      console.log("[WorkloadModal] userIds clean:", clean);
      console.log("[WorkloadModal] first id type:", typeof clean[0]);
    }
    return clean;
  }, [assignableEmployees]);
  const profileIdToEmployee = useMemo(
    () => new Map(assignableEmployees.map((e) => [e.id, e])),
    [assignableEmployees]
  );
  const userIdToProfileId = useMemo(
    () => new Map(assignableEmployees.map((e) => [e.user_id, e.id])),
    [assignableEmployees]
  );

  useEffect(() => {
    if (open && initialSelectedProfileIds) {
      setSelectedProfileIds([...initialSelectedProfileIds]);
    }
  }, [open, initialSelectedProfileIds?.join(",")]);

  // Refetch workload whenever modal opens so counts/calendar reflect latest assignments (no stale cache).
  useEffect(() => {
    if (!open) {
      setWorkloadData([]);
      return;
    }
    if (!userIds || userIds.length === 0) {
      console.warn("[WorkloadModal] No userIds - skipping fetch");
      setWorkloadData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const monthStr = format(month, "yyyy-MM");
    const cacheBuster = `_=${Date.now()}`;
    const apiUrl = `/tasks/workload?userIds=${userIds.join(",")}&month=${monthStr}&${cacheBuster}`;
    console.log("[WorkloadModal] workload userIds:", userIds);
    console.log("[WorkloadModal] calling:", apiUrl);
    api
      .get<WorkloadItem[]>(apiUrl)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        const arr = Array.isArray(data) ? data : (data as { data?: WorkloadItem[] } | null)?.data ?? [];
        console.log("[WorkloadModal] API response length:", arr?.length);
        console.log("[WorkloadModal] API response (summary):", arr?.map((r) => ({ user_id: r.user_id, active_count: r.active_count, tasks_this_month: (r.tasks_this_month || []).length })));
        if (error || !data) setWorkloadData([]);
        else setWorkloadData(arr);
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, userIds.join(",")]);

  const workloadWithEmployee = useMemo(() => {
    return workloadData
      .map((w) => {
        const profileId = w.profile_id || userIdToProfileId.get(w.user_id);
        const emp = profileId ? profileIdToEmployee.get(profileId) : assignableEmployees.find((e) => e.user_id === w.user_id);
        return { ...w, employee: emp, profileId };
      })
      .filter((w) => w.employee);
  }, [workloadData, profileIdToEmployee, userIdToProfileId, assignableEmployees]);

  const sortedWorkload = useMemo(() => {
    const arr = [...workloadWithEmployee];
    if (sort === "lightest") arr.sort((a, b) => a.active_count - b.active_count);
    else if (sort === "heaviest") arr.sort((a, b) => b.active_count - a.active_count);
    else arr.sort((a, b) => (a.employee?.full_name || "").localeCompare(b.employee?.full_name || ""));
    return arr;
  }, [workloadWithEmployee, sort]);

  const selectedEmployees = useMemo(() => {
    return selectedProfileIds
      .map((id) => profileIdToEmployee.get(id))
      .filter(Boolean) as AssignableEmployee[];
  }, [selectedProfileIds, profileIdToEmployee]);

  const workloadMapForSelection = useMemo(() => {
    const map: Record<string, WorkloadLevel> = {};
    workloadWithEmployee.forEach((w) => {
      if (w.profileId && selectedProfileIds.includes(w.profileId)) {
        map[w.profileId] = w.workload_level;
      }
    });
    return map;
  }, [workloadWithEmployee, selectedProfileIds]);

  const toggleSelect = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((p) => p !== profileId) : [...prev, profileId]
    );
  };

  const handleAssignSelected = () => {
    onAssignSelected(selectedProfileIds, workloadMapForSelection);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedProfileIds([]);
    onOpenChange(false);
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const byDay: Record<string, { userId: string; profileId: string; fullName: string; workloadLevel: WorkloadLevel; task: WorkloadTask }[]> = {};
    workloadWithEmployee.forEach((w) => {
      const emp = w.employee!;
      (w.tasks_this_month || []).forEach((task) => {
        const taskDay = task.task_date || task.due_date;
        const dayKey = taskDay ? format(new Date(taskDay), "yyyy-MM-dd") : null;
        if (!dayKey) return;
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push({
          userId: w.user_id,
          profileId: w.profileId!,
          fullName: emp.full_name || "",
          workloadLevel: w.workload_level,
          task,
        });
      });
    });
    return byDay;
  }, [workloadWithEmployee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">See current task load before assigning</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setTab("workload")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5",
                tab === "workload" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              <Users className="w-4 h-4" />
              Workload View
            </button>
            <button
              type="button"
              onClick={() => setTab("calendar")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5",
                tab === "calendar" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              <Calendar className="w-4 h-4" />
              Calendar View
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Light (0-2)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate (3-5)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Heavy (6+)</span>
            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Has overdue</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "workload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assign to employees with lighter workload for better task distribution.
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Sort:</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="p-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="lightest">Lightest first</option>
                  <option value="heaviest">Heaviest first</option>
                  <option value="az">A-Z</option>
                </select>
              </div>
              {loading ? (
                <div className="grid gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : assignableEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No employees available for this department
                </p>
              ) : (
                <div className="grid gap-3">
                  {sortedWorkload.map((w) => {
                    const emp = w.employee!;
                    const profileId = w.profileId!;
                    const selected = selectedProfileIds.includes(profileId);
                    const expanded = expandedUserId === w.user_id;
                    const barMax = 10;
                    const barFill = Math.min(w.active_count, barMax);
                    return (
                      <div
                        key={w.user_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelect(profileId)}
                        onKeyDown={(e) => e.key === "Enter" && toggleSelect(profileId)}
                        className={cn(
                          "rounded-xl border p-4 cursor-pointer transition-colors text-left",
                          selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox checked={selected} onCheckedChange={() => toggleSelect(profileId)} className="mt-0.5" />
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary overflow-hidden flex-shrink-0">
                            {emp.avatar_url ? (
                              <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (emp.full_name || "?").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{emp.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[emp.job_title, emp.department].filter(Boolean).join(" · ") || "—"}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className={cn("px-2 py-0.5 rounded text-xs font-medium uppercase", WORKLOAD_BADGE[w.workload_level])}>
                                {w.workload_level} — {w.active_count} active
                              </span>
                              {w.overdue_count > 0 && (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <AlertCircle className="w-3 h-3" />
                                  {w.overdue_count} overdue
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 mt-1.5">
                              {Array.from({ length: barMax }).map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "h-1.5 flex-1 rounded-sm",
                                    i < barFill ? WORKLOAD_COLORS[w.workload_level] : "bg-muted"
                                  )}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Pending: {w.pending_count} · In progress: {w.in_progress_count}
                              {w.due_this_week_count > 0 && ` · Due this week: ${w.due_this_week_count}`}
                            </p>
                            {(w.hours_booked_today != null || w.hours_booked_this_week != null) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span>Today: {w.hours_booked_today ?? 0}h booked</span>
                                {" · "}
                                <span>This week: {w.hours_booked_this_week ?? 0}h booked</span>
                              </p>
                            )}
                            {(() => {
                              const todayStr = format(new Date(), "yyyy-MM-dd");
                              const tasksToday = (w.tasks_this_month || []).filter((t) => {
                                const day = t.task_date || t.due_date;
                                return day && format(new Date(day), "yyyy-MM-dd") === todayStr;
                              });
                              return tasksToday.length > 0 ? (
                                <div className="text-xs mt-2 space-y-0.5">
                                  <p className="font-medium text-muted-foreground">Tasks today:</p>
                                  {tasksToday.slice(0, 3).map((t) => (
                                    <p key={t.id} className="text-muted-foreground">
                                      • &quot;{t.title}&quot;
                                      {formatTaskDurationHours(t.duration_hours) && (
                                        <span className="ml-1 text-primary">
                                          ({formatTaskDurationHours(t.duration_hours)})
                                        </span>
                                      )}
                                    </p>
                                  ))}
                                  {tasksToday.length > 3 && (
                                    <p className="text-muted-foreground">+{tasksToday.length - 3} more</p>
                                  )}
                                </div>
                              ) : null;
                            })()}
                            {w.tasks_this_month?.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setExpandedUserId(expanded ? null : w.user_id); }}
                                  className="flex items-center gap-1 text-xs text-primary mt-2"
                                >
                                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  {expanded ? "Hide tasks" : "Show tasks"}
                                </button>
                                {expanded && (
                                  <ul className="mt-2 space-y-1 text-xs border-t border-border pt-2">
                                    {w.tasks_this_month.map((t) => (
                                      <li key={t.id} className="flex justify-between gap-2 items-start">
                                        <span className="truncate">{t.title}</span>
                                        <span className="text-muted-foreground shrink-0 text-right">
                                          {t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}
                                          {formatTaskDurationHours(t.duration_hours) && (
                                            <span className="block text-[10px] text-primary">
                                              ⏱ {formatTaskDurationHours(t.duration_hours)}
                                            </span>
                                          )}
                                          <span className="block text-[10px]">{t.status}</span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "calendar" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
                  &larr;
                </Button>
                <span className="font-medium">{format(month, "MMMM yyyy")}</span>
                <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
                  &rarr;
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayTasks = tasksByDay[dayKey] || [];
                  const isCurrentMonth = isSameMonth(day, month);
                  const isSelected = selectedDayKey === dayKey;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDayKey(dayTasks.length ? (isSelected ? null : dayKey) : null)}
                      className={cn(
                        "min-h-[80px] p-2 border rounded-lg text-sm text-left",
                        isCurrentMonth ? "bg-background border-border" : "bg-muted/30 border-transparent text-muted-foreground",
                        isToday(day) && "ring-2 ring-primary",
                        isSelected && "ring-2 ring-primary"
                      )}
                    >
                      <div className="font-medium">{format(day, "d")}</div>
                      <div className="mt-1 space-y-0.5">
                        {dayTasks.slice(0, 3).map(({ profileId, fullName, workloadLevel, task }) => (
                          <div key={`${profileId}-${task.id}`} className="flex flex-col gap-0.5 text-xs">
                            <div className="flex items-center gap-1">
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", WORKLOAD_COLORS[workloadLevel])} />
                              <span className="truncate">{fullName.split(" ")[0]}</span>
                            </div>
                            {formatTaskDurationHours(task.duration_hours) && (
                              <span className="text-[10px] text-muted-foreground ml-2.5 inline-flex items-center gap-1">
                                <span className="px-1 py-0 rounded bg-muted border border-border">
                                  ⏱ {formatTaskDurationHours(task.duration_hours)}
                                </span>
                              </span>
                            )}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayTasks.length - 3} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedDayKey && tasksByDay[selectedDayKey]?.length > 0 && (
                <div
                  className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30"
                  style={{
                    animation: "workloadDayExpand 0.3s ease-out",
                  }}
                >
                  <style>{`
                    @keyframes workloadDayExpand {
                      from { max-height: 0; opacity: 0; }
                      to { max-height: 800px; opacity: 1; }
                    }
                  `}</style>
                  <div className="p-3">
                    <p className="text-sm font-medium mb-3">
                      {format(new Date(selectedDayKey), "MMMM d")} — Tasks
                    </p>
                    <ul className="space-y-2 text-sm">
                      {tasksByDay[selectedDayKey].map(({ profileId, fullName, workloadLevel, task }) => (
                        <li
                          key={`${profileId}-${task.id}`}
                          className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/80 p-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", WORKLOAD_COLORS[workloadLevel])} />
                              <span className="font-medium truncate">{fullName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{task.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Due: {task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : "—"}
                              {formatTaskDurationHours(task.duration_hours) && (
                                <span className="ml-2 text-primary">
                                  ⏱ {formatTaskDurationHours(task.duration_hours)}
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs h-8"
                            onClick={() => {
                              if (!selectedProfileIds.includes(profileId)) {
                                setSelectedProfileIds((prev) => [...prev, profileId]);
                              }
                            }}
                          >
                            + Select
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Selected ({selectedProfileIds.length}):</span>
            {selectedEmployees.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-primary/10 text-primary text-xs"
              >
                {e.full_name}
                <button
                  type="button"
                  onClick={() => setSelectedProfileIds((prev) => prev.filter((p) => p !== e.id))}
                  className="p-0.5 hover:bg-primary/20 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedProfileIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedProfileIds([])}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleAssignSelected} disabled={selectedProfileIds.length === 0}>
              Assign Selected ({selectedProfileIds.length}) →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
