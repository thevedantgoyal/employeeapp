import { useEffect } from "react";
import { motion } from "framer-motion";
import { format, isToday, isFuture } from "date-fns";
import { Trash2, Clock, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TimesheetEntry, TimesheetStatus } from "@/hooks/useTimesheetManagement";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  selectedMonth: Date;
  setSelectedMonth: (date: Date) => void;
  fetchMonthEntries: (month: Date) => void;
  monthLoading: boolean;
  monthDays: Date[];
  getEntriesForMonthDate: (date: Date) => TimesheetEntry[];
  getDailyHoursForMonth: (date: Date) => number;
  weekStatus: TimesheetStatus;
  onDeleteEntry: (id: string) => void;
}

export const MonthlyView = ({
  selectedMonth,
  setSelectedMonth,
  fetchMonthEntries,
  monthLoading,
  monthDays,
  getEntriesForMonthDate,
  getDailyHoursForMonth,
  weekStatus,
  onDeleteEntry,
}: Props) => {
  useEffect(() => {
    fetchMonthEntries(selectedMonth);
  }, [selectedMonth, fetchMonthEntries]);

  const monthNum = selectedMonth.getMonth();
  const yearNum = selectedMonth.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => yearNum - 2 + i);

  const handleMonthChange = (value: string) => {
    const m = parseInt(value, 10);
    if (Number.isNaN(m)) return;
    setSelectedMonth(new Date(selectedMonth.getFullYear(), m, 1));
  };

  const handleYearChange = (value: string) => {
    const y = parseInt(value, 10);
    if (Number.isNaN(y)) return;
    setSelectedMonth(new Date(y, selectedMonth.getMonth(), 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Monthly Breakdown</h2>
        <div className="flex items-center gap-2">
          <Select value={String(monthNum)} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, i) => (
                <SelectItem key={name} value={String(i)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(yearNum)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {monthLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1" role="region" aria-label="Month days list">
          {monthDays.map((day, i) => {
            const entries = getEntriesForMonthDate(day);
            const dailyHours = getDailyHoursForMonth(day);
            const future = isFuture(day);
            const today = isToday(day);

            return (
              <motion.div
                key={day.toISOString()}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Collapsible>
                  <Card
                    className={`border-border/50 ${today ? "ring-1 ring-primary/30" : ""} ${future ? "opacity-50" : ""}`}
                  >
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`text-center min-w-[44px] ${today ? "text-primary font-bold" : ""}`}>
                            <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                            <p className="text-sm font-semibold">{format(day, "dd")}</p>
                            <p className="text-[10px] text-muted-foreground">{format(day, "MMM")}</p>
                          </div>
                          {today && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              Today
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {dailyHours > 0 ? `${dailyHours}h` : "—"}
                          </span>
                          {entries.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {entries.length} entries
                            </Badge>
                          )}
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>

                    {entries.length > 0 && (
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2.5"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="secondary" className="text-[10px] font-normal">{entry.workType}</Badge>
                                  {entry.workType === "Project Work" ? (
                                    <>
                                      <span className="font-medium">{entry.projectName}</span>
                                      <span className="text-muted-foreground">/</span>
                                      <span>{entry.taskTitle}</span>
                                    </>
                                  ) : (
                                    <span className="font-medium">{entry.activityTitle || "—"}</span>
                                  )}
                                </div>
                                {entry.description && (
                                  <p className="text-muted-foreground mt-1">{entry.description}</p>
                                )}
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{format(new Date(entry.createdAt), "hh:mm a")}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.hours}h
                                </Badge>
                                {weekStatus === "incomplete" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteEntry(entry.id);
                                    }}
                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    )}
                  </Card>
                </Collapsible>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
