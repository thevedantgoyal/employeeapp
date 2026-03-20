import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export interface TaskTimeSlotFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  durationHours: string;
  onDurationHoursChange: (value: string) => void;
  dueDate?: string;
  error?: string;
}

export function TaskTimeSlotFields({
  enabled,
  onEnabledChange,
  durationHours,
  onDurationHoursChange,
  dueDate,
  error,
}: TaskTimeSlotFieldsProps) {
  const durationDisplay = useMemo(() => {
    const n = Number(durationHours);
    if (!Number.isFinite(n) || n <= 0) return null;
    return formatDuration(n);
  }, [durationHours]);

  const dueDateHint = useMemo(() => {
    if (!dueDate) return "uses due date";
    try {
      return `uses due date: ${format(new Date(dueDate), "dd MMM yyyy")}`;
    } catch {
      return "uses due date";
    }
  }, [dueDate]);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="rounded border-border"
        />
        <span className="font-medium">Add estimated effort (hours)</span>
      </label>
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{ maxHeight: enabled ? "180px" : "0px", opacity: enabled ? 1 : 0 }}
      >
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <Label className="text-sm font-medium">Estimated effort</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Hours</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={durationHours}
                onChange={(e) => onDurationHoursChange(e.target.value)}
                placeholder="e.g. 1.5"
                className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Duration</span>
              <span className="text-xs px-2 py-1.5 rounded-full bg-primary text-primary-foreground inline-flex">
                {durationDisplay || "0h 00m"}
              </span>
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{dueDateHint}</p>
        </div>
      </div>
    </div>
  );
}

export { formatDuration };
