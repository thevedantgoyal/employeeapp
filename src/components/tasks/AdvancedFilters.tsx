import { useState } from "react";
import { Filter, X, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { useAllTags } from "@/hooks/useTaskTags";
import { cn } from "@/lib/utils";
import { ScrollablePillRow } from "@/components/ui/scrollable-pill-row";

export interface TaskFilters {
  status: string;
  priority: string;
  tagIds: string[];
  dateRange: { from: string; to: string };
  assigneeId: string;
  taskType: string;
  search: string;
}

const defaultFilters: TaskFilters = {
  status: "",
  priority: "",
  tagIds: [],
  dateRange: { from: "", to: "" },
  assigneeId: "",
  taskType: "",
  search: "",
};

interface AdvancedFiltersProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  assignees?: { id: string; name: string }[];
  showAssigneeFilter?: boolean;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "approved", label: "Approved" },
];

const priorityOptions = [
  { value: "", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const taskTypeOptions = [
  { value: "", label: "All Types" },
  { value: "project_task", label: "Project Task" },
  { value: "separate_task", label: "Ad-hoc Task" },
];

export const AdvancedFilters = ({
  filters,
  onFiltersChange,
  assignees = [],
  showAssigneeFilter = false,
}: AdvancedFiltersProps) => {
  const [expanded, setExpanded] = useState(false);
  const { data: tags = [] } = useAllTags();

  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.tagIds.length > 0,
    filters.dateRange.from || filters.dateRange.to,
    filters.assigneeId,
    filters.taskType,
    filters.search,
  ].filter(Boolean).length;

  const update = (partial: Partial<TaskFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const toggleTag = (tagId: string) => {
    const newTags = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter(id => id !== tagId)
      : [...filters.tagIds, tagId];
    update({ tagIds: newTags });
  };

  const clearAll = () => onFiltersChange(defaultFilters);

  return (
    <div className="space-y-3">
      {/* Search + toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search tasks..."
            className="w-full p-2.5 pl-9 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors",
            activeFilterCount > 0
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Quick status pills — Option C: horizontal scroll with fade edges */}
      <div className="pb-1">
        <ScrollablePillRow>
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ status: opt.value })}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                filters.status === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted border border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </ScrollablePillRow>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="p-4 bg-card rounded-xl border border-border/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => update({ priority: e.target.value })}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              >
                {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Task Type</label>
              <select
                value={filters.taskType}
                onChange={(e) => update({ taskType: e.target.value })}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              >
                {taskTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {showAssigneeFilter && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignee</label>
                <select
                  value={filters.assigneeId}
                  onChange={(e) => update({ assigneeId: e.target.value })}
                  className="w-full p-2 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="">All Assignees</option>
                  {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due From</label>
              <input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) => update({ dateRange: { ...filters.dateRange, from: e.target.value } })}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due To</label>
              <input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => update({ dateRange: { ...filters.dateRange, to: e.target.value } })}
                className="w-full p-2 text-sm rounded-lg border border-border bg-background"
              />
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium transition-all",
                      filters.tagIds.includes(tag.id) ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-100"
                    )}
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      ...(filters.tagIds.includes(tag.id) ? { ringColor: tag.color } : {}),
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { defaultFilters };
