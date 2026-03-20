import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/integrations/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TemplateRow = {
  id: string;
  task_title: string;
  description_hint: string | null;
  required_job_titles: string[];
  is_active: boolean;
  created_at: string;
};

type TemplatesByDept = Record<string, TemplateRow[]>;

export function TaskTemplatesManagement() {
  const [byDept, setByDept] = useState<TemplatesByDept>({});
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [filterDept, setFilterDept] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDepartment, setFormDepartment] = useState("");
  const [formTaskTitle, setFormTaskTitle] = useState("");
  const [formDescriptionHint, setFormDescriptionHint] = useState("");
  const [formRequiredTitles, setFormRequiredTitles] = useState<string[]>([]);
  const [formNewTitle, setFormNewTitle] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileDepartments, setProfileDepartments] = useState<string[]>([]);

  const departments = useMemo(
    () => [...new Set([...Object.keys(byDept), ...profileDepartments])].sort(),
    [byDept, profileDepartments]
  );

  const flatTemplates = useMemo(() => {
    const out: (TemplateRow & { department: string })[] = [];
    Object.entries(byDept).forEach(([dept, rows]) => {
      rows.forEach((r) => out.push({ ...r, department: dept }));
    });
    return out;
  }, [byDept]);

  const filteredTemplates = useMemo(() => {
    if (!filterDept) return flatTemplates;
    return flatTemplates.filter((t) => t.department === filterDept);
  }, [flatTemplates, filterDept]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [tplRes, jobRes, deptRes] = await Promise.all([
        api.get<TemplatesByDept>("/admin/task-templates"),
        api.get<string[]>("/admin/task-templates/job-titles"),
        api.get<string[]>("/tasks/departments"),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (tplRes.data) setByDept(tplRes.data);
      if (jobRes.data) setJobTitles(jobRes.data);
      if (deptRes.data) setProfileDepartments(deptRes.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormDepartment(departments[0] || "");
    setFormTaskTitle("");
    setFormDescriptionHint("");
    setFormRequiredTitles([]);
    setFormNewTitle("");
    setFormActive(true);
    setModalOpen(true);
  };

  const openEdit = (t: TemplateRow & { department: string }) => {
    setEditingId(t.id);
    setFormDepartment(t.department);
    setFormTaskTitle(t.task_title);
    setFormDescriptionHint(t.description_hint || "");
    setFormRequiredTitles(t.required_job_titles || []);
    setFormNewTitle("");
    setFormActive(t.is_active);
    setModalOpen(true);
  };

  const addChipFromExisting = (title: string) => {
    if (title && !formRequiredTitles.includes(title)) {
      setFormRequiredTitles((prev) => [...prev, title]);
    }
  };

  const addChipFromNew = () => {
    const t = formNewTitle.trim();
    if (t && !formRequiredTitles.includes(t)) {
      setFormRequiredTitles((prev) => [...prev, t]);
      setFormNewTitle("");
    }
  };

  const removeChip = (title: string) => {
    setFormRequiredTitles((prev) => prev.filter((x) => x !== title));
  };

  const saveTemplate = async () => {
    if (!formDepartment.trim() || !formTaskTitle.trim()) {
      toast.error("Department and Task Title are required");
      return;
    }
    setSaving(true);
    if (editingId) {
      const { data, error } = await api.patch<TemplateRow>(`/admin/task-templates/${editingId}`, {
        department: formDepartment.trim(),
        task_title: formTaskTitle.trim(),
        description_hint: formDescriptionHint.trim() || null,
        required_job_titles: formRequiredTitles,
        is_active: formActive,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message || "Failed to update template");
        return;
      }
      toast.success("Template updated");
    } else {
      const { data, error } = await api.post<TemplateRow>("/admin/task-templates", {
        department: formDepartment.trim(),
        task_title: formTaskTitle.trim(),
        description_hint: formDescriptionHint.trim() || null,
        required_job_titles: formRequiredTitles,
        is_active: formActive,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message || "Failed to create template");
        return;
      }
      toast.success("Template created");
    }
    setModalOpen(false);
    const [tplRes] = await Promise.all([api.get<TemplatesByDept>("/admin/task-templates")]);
    if (tplRes.data) setByDept(tplRes.data);
  };

  const deactivate = async (id: string) => {
    const { error } = await api.delete(`/admin/task-templates/${id}`);
    if (error) {
      toast.error(error.message || "Failed to deactivate");
      return;
    }
    toast.success("Template deactivated");
    const { data } = await api.get<TemplatesByDept>("/admin/task-templates");
    if (data) setByDept(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Department Task Templates</h2>
        <Button onClick={openAdd} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Template
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterDept("")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium",
            !filterDept ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          All
        </button>
        {departments.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilterDept(d)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              filterDept === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Department</th>
                <th className="text-left p-3 font-medium">Task Title</th>
                <th className="text-left p-3 font-medium">Required Job Titles</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No templates found. Add one to get started.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3">{t.department}</td>
                    <td className="p-3">{t.task_title}</td>
                    <td className="p-3">
                      {(t.required_job_titles || []).length
                        ? t.required_job_titles.join(", ")
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          t.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(t)}>
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                      {t.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          onClick={() => deactivate(t.id)}
                        >
                          <EyeOff className="w-3 h-3" />
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "Add Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Department *</Label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                {departments.length === 0 && <option value="">No departments</option>}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Task Title *</Label>
              <Input
                value={formTaskTitle}
                onChange={(e) => setFormTaskTitle(e.target.value)}
                placeholder="e.g. Monthly Reconciliation"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description Hint (optional)</Label>
              <Textarea
                value={formDescriptionHint}
                onChange={(e) => setFormDescriptionHint(e.target.value)}
                placeholder="Shown as placeholder in task description"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Required Job Titles</Label>
              <div className="flex gap-2 flex-wrap">
                {formRequiredTitles.map((title) => (
                  <span
                    key={title}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-primary/10 text-primary text-xs"
                  >
                    {title}
                    <button type="button" onClick={() => removeChip(title)} className="p-0.5 hover:bg-primary/20 rounded">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <select
                  value=""
                  onChange={(e) => { addChipFromExisting(e.target.value); e.target.value = ""; }}
                  className="flex-1 p-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">Select from existing</option>
                  {jobTitles.filter((j) => !formRequiredTitles.includes(j)).map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <Input
                  value={formNewTitle}
                  onChange={(e) => setFormNewTitle(e.target.value)}
                  placeholder="Or type new"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChipFromNew())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addChipFromNew}>
                  Add
                </Button>
              </div>
            </div>
            {editingId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={formActive} onChange={() => setFormActive(true)} />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={!formActive} onChange={() => setFormActive(false)} />
                    Inactive
                  </label>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? "Save Template" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
