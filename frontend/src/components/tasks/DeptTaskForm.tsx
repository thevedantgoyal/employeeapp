import { useState, useEffect, useMemo } from "react";
import {
  Building2,
  FileText,
  User,
  Users,
  Calendar,
  Flag,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { WorkloadModal, type WorkloadLevel } from "@/components/tasks/WorkloadModal";
import { TaskTimeSlotFields } from "@/components/tasks/TaskTimeSlotFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/integrations/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CUSTOM_TITLE_VALUE = "__custom__";

/** Display names for department dropdown (value sent to API unchanged). */
const DEPARTMENT_DISPLAY_NAMES: Record<string, string> = {
  "Data&Ai": "Data & AI",
  "Cybersecurity": "Cybersecurity",
  "Security": "Cybersecurity",
  "IT Help Desk": "IT Help Desk",
  "SCM": "Supply Chain Management (SCM)",
  "HR": "Human Resources",
};
function getDepartmentDisplayName(dept: string): string {
  return DEPARTMENT_DISPLAY_NAMES[dept] ?? dept;
}

function parseDurationInput(value: string): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Template = {
  id: string;
  task_title: string;
  description_hint: string | null;
  required_job_titles: string[];
};

type Assignee = {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  department: string | null;
  /** When non-empty, task creation shows only these template ids (per admin). */
  assigned_task_template_ids?: string[] | null;
  fit_score?: number;
  matched_skills?: number;
  fit_label?: "best_fit" | "good_fit" | "possible_fit" | "no_match";
};

type GroupedAssignees = Record<string, Assignee[]>;

interface DeptTaskFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function DeptTaskForm({ onSuccess, onCancel }: DeptTaskFormProps) {
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | "">("");
  const [customTitle, setCustomTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneesGrouped, setAssigneesGrouped] = useState<GroupedAssignees>({});
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showAllInDept, setShowAllInDept] = useState(false);
  const [taskMode, setTaskMode] = useState<"individual" | "shared">("individual");
  const [durationHours, setDurationHours] = useState("");
  const [useTimeSlot, setUseTimeSlot] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workloadModalOpen, setWorkloadModalOpen] = useState(false);
  const [assigneeWorkloadMap, setAssigneeWorkloadMap] = useState<Record<string, WorkloadLevel>>({});
  const [assigneeNextDue, setAssigneeNextDue] = useState<
    Record<string, { title: string; due_date: string; duration_hours: number | null }>
  >({});

  const flatAssignees = useMemo(() => {
    const out: Assignee[] = [];
    Object.values(assigneesGrouped).forEach((arr) => arr.forEach((a) => out.push(a)));
    return out;
  }, [assigneesGrouped]);

  const visibleTemplates = useMemo(() => {
    if (!templates.length) return [];
    if (selectedProfileIds.length === 0) return templates;
    const selected = selectedProfileIds
      .map((id) => flatAssignees.find((a) => a.id === id))
      .filter(Boolean) as Assignee[];
    if (selected.length === 0) return templates;
    const perAssignee = selected.map((a) => {
      const ids = a.assigned_task_template_ids;
      return Array.isArray(ids) && ids.length > 0 ? ids : null;
    });
    if (perAssignee.some((x) => x == null)) return templates;
    let inter = new Set(perAssignee[0]);
    for (let k = 1; k < perAssignee.length; k++) {
      inter = new Set([...inter].filter((id) => perAssignee[k]!.includes(id)));
    }
    const filtered = templates.filter((t) => inter.has(t.id));
    return filtered.length > 0 ? filtered : templates;
  }, [templates, selectedProfileIds, flatAssignees]);

  const taskTitle =
    selectedTemplateId === CUSTOM_TITLE_VALUE
      ? customTitle.trim()
      : (visibleTemplates.find((t) => t.id === selectedTemplateId)?.task_title ?? "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDepts(true);
      const { data, error } = await api.get<string[]>("/tasks/departments");
      if (cancelled) return;
      setLoadingDepts(false);
      if (error || !data) {
        toast.error(error?.message || "Failed to load departments");
        return;
      }
      setDepartments(data);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!department) {
      setTemplates([]);
      setSelectedTemplateId("");
      setDescription("");
      setAssigneesGrouped({});
      setSelectedProfileIds([]);
      return;
    }
    let cancelled = false;
    setLoadingTemplates(true);
    (async () => {
      const { data, error } = await api.get<Template[]>(`/tasks/templates/${encodeURIComponent(department)}`);
      if (cancelled) return;
      setLoadingTemplates(false);
      if (error) {
        toast.error(error.message || "Failed to load templates");
        return;
      }
      setTemplates(data || []);
      setSelectedTemplateId("");
      setDescription("");
    })();
    return () => { cancelled = true; };
  }, [department]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId]);
  const jobTitlesFilter = selectedTemplate?.required_job_titles?.length ? selectedTemplate.required_job_titles : null;

  useEffect(() => {
    if (!department) {
      setAssigneesGrouped({});
      setSelectedProfileIds([]);
      return;
    }
    let cancelled = false;
    setLoadingAssignees(true);
    const isCustom = selectedTemplateId === CUSTOM_TITLE_VALUE || !selectedTemplateId;
    const jobTitles = showAllInDept || isCustom ? null : jobTitlesFilter;
    const q = new URLSearchParams({ department });
    if (jobTitles?.length) q.set("jobTitles", jobTitles.join(","));
    if (isCustom) q.set("isCustom", "true");
    if (taskTitle) q.set("taskTitle", taskTitle);
    (async () => {
      const { data, error } = await api.get<GroupedAssignees>(`/tasks/assignees?${q.toString()}`);
      if (cancelled) return;
      setLoadingAssignees(false);
      if (error) {
        toast.error(error.message || "Failed to load assignees");
        return;
      }
      setAssigneesGrouped(data || {});
    })();
    return () => { cancelled = true; };
  }, [department, showAllInDept, jobTitlesFilter?.join(","), taskTitle, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplate?.description_hint && !description) {
      setDescription(selectedTemplate.description_hint);
    }
  }, [selectedTemplate?.description_hint]);

  useEffect(() => {
    if (!selectedTemplateId || selectedTemplateId === CUSTOM_TITLE_VALUE) return;
    if (!visibleTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [visibleTemplates, selectedTemplateId]);

  const filteredFlat = useMemo(() => {
    if (!assigneeSearch.trim()) return flatAssignees;
    const s = assigneeSearch.trim().toLowerCase();
    return flatAssignees.filter((a) => (a.full_name || "").toLowerCase().includes(s));
  }, [flatAssignees, assigneeSearch]);

  const filteredGrouped = useMemo(() => {
    const next: GroupedAssignees = {};
    const idSet = new Set(filteredFlat.map((a) => a.id));
    Object.entries(assigneesGrouped).forEach(([jt, arr]) => {
      const filtered = arr.filter((a) => idSet.has(a.id));
      if (filtered.length) next[jt] = filtered;
    });
    return next;
  }, [assigneesGrouped, filteredFlat]);

  const selectedAssignees = useMemo(() => {
    return selectedProfileIds.map((id) => flatAssignees.find((a) => a.id === id)).filter(Boolean) as Assignee[];
  }, [selectedProfileIds, flatAssignees]);

  useEffect(() => {
    if (flatAssignees.length === 0) {
      setAssigneeNextDue({});
      return;
    }
    let cancelled = false;
    const ids = flatAssignees.map((a) => a.id).join(",");
    api
      .get<Record<string, { title: string; due_date: string; duration_hours: number | null }>>(
        "/tasks/next-due-by-assignees",
        { profileIds: ids }
      )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) return;
        setAssigneeNextDue(data);
      });
    return () => {
      cancelled = true;
    };
  }, [flatAssignees]);

  const handleSubmit = async () => {
    if (!department.trim()) {
      toast.error("Select a department");
      return;
    }
    if (!taskTitle) {
      toast.error("Enter or select a task title");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (selectedProfileIds.length === 0) {
      toast.error("Select at least one assignee");
      return;
    }
    const due = dueDate.trim();
    if (!due) {
      toast.error("Due date is required");
      return;
    }
    const d = new Date(due);
    if (Number.isNaN(d.getTime()) || d <= new Date()) {
      toast.error("Due date must be in the future");
      return;
    }
    const parsedDuration = parseDurationInput(durationHours);
    if (useTimeSlot) {
      if (parsedDuration == null) {
        toast.error("Enter valid duration hours");
        return;
      }
    }

    const payload: Record<string, unknown> = {
      department: department.trim(),
      template_id: selectedTemplateId && selectedTemplateId !== CUSTOM_TITLE_VALUE ? selectedTemplateId : null,
      task_title: taskTitle,
      description: description.trim(),
      priority,
      due_date: due,
      assignee_ids: selectedProfileIds,
      task_mode: taskMode,
      task_date: null,
      duration_hours: null,
    };
    if (useTimeSlot) {
      payload.task_date = due.trim().slice(0, 10);
      payload.duration_hours = parsedDuration;
      payload.durationHours = parsedDuration;
      payload.taskDate = payload.task_date;
    }
    console.log("[CreateTask] payload:", payload);
    setSubmitting(true);
    const { data, error } = await api.post<{ created: number; tasks: unknown[] }>("/tasks/dept-task", payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Failed to create task(s)");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["home-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["home-stats"] }),
    ]);
    toast.success(`Created ${data?.created ?? 0} task(s)`);
    onSuccess();
  };

  const minDueDate = new Date();
  minDueDate.setDate(minDueDate.getDate() + 1);
  const minDueStr = minDueDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Assign to department team</p>

      {/* Step 1 — Department */}
      <div className="space-y-1.5">
        <Label>Department *</Label>
        <div className="relative">
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSelectedProfileIds([]);
              setShowAllInDept(false);
            }}
            className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d} value={d}>{getDepartmentDisplayName(d)}</option>
            ))}
          </select>
          <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Step 2 — Task Title (template or custom) */}
      <div className="space-y-1.5">
        <Label>Task Title *</Label>
        <div className="relative">
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              if (e.target.value !== CUSTOM_TITLE_VALUE) setCustomTitle("");
            }}
            disabled={!department || loadingTemplates}
            className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
          >
            <option value="">Select template</option>
            {(visibleTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>{t.task_title}</option>
            ))}
            <option value={CUSTOM_TITLE_VALUE}>— Custom task title —</option>
          </select>
          <FileText className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {selectedTemplateId === CUSTOM_TITLE_VALUE && (
          <Input
            placeholder="Enter custom task title..."
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="mt-2"
          />
        )}
      </div>

      {/* Step 3 — Assign To */}
      <div className="space-y-1.5">
        <Label>Assign To *</Label>
        <p className="text-xs text-muted-foreground">
          Showing employees in {department ? getDepartmentDisplayName(department) : "…"} {jobTitlesFilter?.length && !showAllInDept ? `matching this task type` : ""}
        </p>
        {department && (
          <button
            type="button"
            onClick={() => setWorkloadModalOpen(true)}
            disabled={flatAssignees.length === 0}
            className={cn(
              "w-full flex items-center gap-2 p-2.5 rounded-lg border border-border text-left mb-2",
              flatAssignees.length > 0 ? "hover:bg-muted/50" : "opacity-60 cursor-not-allowed"
            )}
          >
            <Users className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">View Team Workload</p>
              <p className="text-xs text-muted-foreground">See who has capacity before assigning</p>
            </div>
          </button>
        )}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              className="border-0 h-9 focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto p-2">
            {loadingAssignees ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(filteredGrouped).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No employees found in {department ? getDepartmentDisplayName(department) : "…"} matching this task type.
              </p>
            ) : (
              <>
                {jobTitlesFilter?.length && !showAllInDept && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center mb-2"
                    onClick={() => setShowAllInDept(true)}
                  >
                    Show all in department
                  </Button>
                )}
                {Object.entries(filteredGrouped).map(([jobTitle, arr]) => (
                  <div key={jobTitle} className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1.5 sticky top-0 bg-background border-b border-border/50">
                      {jobTitle.toUpperCase()} ({arr.length})
                    </p>
                    {arr.map((member) => (
                      <label
                        key={member.id}
                        className={cn(
                          "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer",
                          selectedProfileIds.includes(member.id) ? "bg-primary/10" : "hover:bg-muted/60"
                        )}
                      >
                        <Checkbox
                          checked={selectedProfileIds.includes(member.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProfileIds((prev) =>
                              checked ? [...prev, member.id] : prev.filter((x) => x !== member.id)
                            );
                          }}
                        />
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary overflow-hidden">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (member.full_name || "?").slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span className="truncate">{member.full_name}</span>
                            {member.fit_label && member.fit_label !== "no_match" && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                                  member.fit_label === "best_fit" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                                  member.fit_label === "good_fit" && "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                                  member.fit_label === "possible_fit" && "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                )}
                              >
                                {member.fit_label === "best_fit"
                                  ? "Best Fit"
                                  : member.fit_label === "good_fit"
                                    ? "Good Fit"
                                    : "Possible"}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[member.job_title, member.employee_code].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {member.matched_skills != null && member.matched_skills > 0 && (
                            <p className="text-[11px] text-muted-foreground/90 mt-0.5 truncate">
                              Skills matched: {member.matched_skills}
                            </p>
                          )}
                          {assigneeNextDue[member.id]?.due_date && (
                            <p className="text-[11px] text-primary/90 mt-0.5 truncate">
                              Next due:{" "}
                              {format(new Date(assigneeNextDue[member.id].due_date), "dd MMM yyyy")}
                              {assigneeNextDue[member.id].duration_hours != null &&
                                assigneeNextDue[member.id].duration_hours! > 0 && (
                                  <>
                                    {" "}
                                    · ⏱ {Math.floor(assigneeNextDue[member.id].duration_hours!)}
                                    h{" "}
                                    {String(
                                      Math.round(
                                        (assigneeNextDue[member.id].duration_hours! % 1) * 60
                                      )
                                    ).padStart(2, "0")}
                                    m
                                  </>
                                )}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {selectedAssignees.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedAssignees.map((a) => {
              const wl = assigneeWorkloadMap[a.id];
              return (
              <span
                key={a.id}
                className="inline-flex items-center gap-0.5 pl-2 pr-1 py-1 rounded-md bg-primary/10 text-primary text-xs"
              >
                {wl && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      wl === "light" && "bg-emerald-500",
                      wl === "moderate" && "bg-amber-500",
                      wl === "heavy" && "bg-red-500"
                    )}
                  />
                )}
                {a.full_name}
                <button
                  type="button"
                  onClick={() => setSelectedProfileIds((prev) => prev.filter((x) => x !== a.id))}
                  className="p-0.5 hover:bg-primary/20 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 4 — Description, Priority, Due */}
      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Textarea
          placeholder="Describe the task..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Priority *</Label>
          <div className="flex gap-2">
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl text-sm font-medium capitalize",
                  priority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Due Date *</Label>
          <div className="relative">
            <input
              type="date"
              value={dueDate}
              min={minDueStr}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 pr-10 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Task Time (optional) — between due_date and Assignment Mode */}
      <TaskTimeSlotFields
        enabled={useTimeSlot}
        onEnabledChange={(enabled) => {
          setUseTimeSlot(enabled);
          if (!enabled) {
            setDurationHours("");
          }
        }}
        durationHours={durationHours}
        onDurationHoursChange={setDurationHours}
        dueDate={dueDate || undefined}
      />

      {/* Step 5 — Individual vs Shared (if 2+ assignees) */}
      {selectedProfileIds.length >= 2 && (
        <div className="space-y-2">
          <Label>Assignment Mode</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="taskMode"
                checked={taskMode === "individual"}
                onChange={() => setTaskMode("individual")}
                className="rounded-full"
              />
              <span className="text-sm">Individual Tasks (each person gets their own task)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="taskMode"
                checked={taskMode === "shared"}
                onChange={() => setTaskMode("shared")}
                className="rounded-full"
              />
              <span className="text-sm">Shared Task (one task all can update)</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={submitting || !taskTitle || !description.trim() || selectedProfileIds.length === 0 || !dueDate}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Create Task
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>

      <WorkloadModal
        open={workloadModalOpen}
        onOpenChange={setWorkloadModalOpen}
        assignableEmployees={flatAssignees.map((e) => ({
          id: e.id,
          user_id: e.user_id,
          full_name: e.full_name,
          job_title: e.job_title ?? null,
          department: e.department ?? null,
          avatar_url: e.avatar_url ?? null,
          employee_code: e.employee_code ?? null,
        }))}
        initialSelectedProfileIds={selectedProfileIds}
        onAssignSelected={(profileIds, workloadMap) => {
          setSelectedProfileIds(profileIds);
          setAssigneeWorkloadMap(workloadMap);
        }}
        title={department ? `${getDepartmentDisplayName(department)} Department Workload` : "Department Workload"}
      />
    </div>
  );
}
