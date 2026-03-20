import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { format, addHours } from "date-fns";
import { AlertTriangle, Calendar } from "lucide-react";

const STORAGE_KEY = "cachetask_deadline_reminder_date";

function isActiveStatus(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  return !["completed", "done", "approved"].includes(s);
}

/**
 * Shows once per calendar day when an employee opens the app (any main layout route),
 * if they have tasks due soon or overdue.
 */
export function TaskDeadlineReminder() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useTasks();
  const [open, setOpen] = useState(false);

  const isEmployee =
    (user?.external_role || "").toLowerCase() === "employee" ||
    (user?.userType || "").toUpperCase() === "EMPLOYEE";

  const urgentTasks = useMemo(() => {
    if (!tasks.length) return [];
    const now = Date.now();
    const soon = addHours(new Date(), 72).getTime();
    const maxOverdueMs = 14 * 24 * 60 * 60 * 1000;
    return tasks
      .filter((t) => isActiveStatus(t.status) && t.due_date)
      .filter((t) => {
        const due = new Date(t.due_date!).getTime();
        if (Number.isNaN(due)) return false;
        if (due < now) return now - due <= maxOverdueMs;
        return due <= soon;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 12);
  }, [tasks]);

  useEffect(() => {
    if (loading || isLoading || !user || !isEmployee) return;
    if (urgentTasks.length === 0) return;

    const today = format(new Date(), "yyyy-MM-dd");
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === today) {
        return;
      }
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, today);
      } catch {
        /* ignore */
      }
    }, 600);

    return () => clearTimeout(t);
  }, [loading, isLoading, user, isEmployee, urgentTasks.length, location.pathname]);

  if (!isEmployee || urgentTasks.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            Upcoming deadlines
          </DialogTitle>
          <DialogDescription>
            You have tasks due soon or overdue. Review them on your Tasks page.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {urgentTasks.map((t) => {
            const d = t.due_date ? new Date(t.due_date) : null;
            const overdue =
              d &&
              !Number.isNaN(d.getTime()) &&
              d.getTime() < Date.now() &&
              isActiveStatus(t.status);
            const dur =
              t.duration_hours != null && t.duration_hours > 0
                ? `${Math.floor(t.duration_hours)}h ${String(Math.round((t.duration_hours % 1) * 60)).padStart(2, "0")}m`
                : null;
            return (
              <li
                key={t.id}
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex flex-col gap-0.5"
              >
                <span className="font-medium line-clamp-2">{t.title}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                  <Calendar className="w-3 h-3 shrink-0" />
                  {d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM yyyy") : "—"}
                  {dur && <span className="text-primary">· ⏱ {dur}</span>}
                  {overdue && (
                    <span className="text-destructive font-medium">· Overdue</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => { setOpen(false); navigate("/tasks"); }}>
            Go to Tasks
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
