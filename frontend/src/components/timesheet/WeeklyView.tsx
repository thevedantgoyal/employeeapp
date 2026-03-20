import { motion } from "framer-motion";
import { format, isToday, isFuture } from "date-fns";
import { Trash2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TimesheetEntry, TimesheetStatus } from "@/hooks/useTimesheetManagement";

interface Props {
  weekDays: Date[];
  getEntriesForDate: (date: Date) => TimesheetEntry[];
  getDailyHours: (date: Date) => number;
  totalWeeklyHours: number;
  targetHours: number;
  weekStatus: TimesheetStatus;
  onDeleteEntry: (id: string) => void;
}

export const WeeklyView = ({
  weekDays,
  getEntriesForDate,
  getDailyHours,
  totalWeeklyHours,
  targetHours,
  weekStatus,
  onDeleteEntry,
}: Props) => {
  const progressPercent = Math.min((totalWeeklyHours / targetHours) * 100, 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Weekly Breakdown</h2>
        <span className="text-sm font-medium">{totalWeeklyHours}h / {targetHours}h</span>
      </div>

      <Progress value={progressPercent} className="h-2" />

      <div className="space-y-2">
        {weekDays.map((day, i) => {
          const entries = getEntriesForDate(day);
          const dailyHours = getDailyHours(day);
          const future = isFuture(day);
          const today = isToday(day);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Collapsible>
                <Card className={`border-border/50 ${today ? "ring-1 ring-primary/30" : ""} ${future ? "opacity-50" : ""}`}>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-center min-w-[40px] ${today ? "text-primary font-bold" : ""}`}>
                          <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                          <p className="text-sm font-semibold">{format(day, "dd")}</p>
                        </div>
                        {today && <Badge variant="outline" className="text-[10px] h-5">Today</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{dailyHours > 0 ? `${dailyHours}h` : "—"}</span>
                        {entries.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{entries.length} entries</Badge>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  {entries.length > 0 && (
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
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
                              <Badge variant="outline" className="text-[10px]">{entry.hours}h</Badge>
                              {weekStatus === "incomplete" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }}
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
    </div>
  );
};
