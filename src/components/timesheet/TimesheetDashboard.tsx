import { motion } from "framer-motion";
import { Clock, Plus, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { TimesheetStatus } from "@/hooks/useTimesheetManagement";

const statusConfig: Record<TimesheetStatus, { icon: React.ReactNode; label: string; className: string }> = {
  incomplete: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: "Incomplete",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  submitted: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "Pending Review",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  approved: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "Approved",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

interface Props {
  totalHours: number;
  targetHours: number;
  weekStatus: TimesheetStatus;
  onLogTime: () => void;
  onSubmitWeek: () => void;
}

export const TimesheetDashboard = ({ totalHours, targetHours, weekStatus, onLogTime, onSubmitWeek }: Props) => {
  const remaining = Math.max(targetHours - totalHours, 0);
  const progressPercent = Math.min((totalHours / targetHours) * 100, 100);
  const status = statusConfig[weekStatus];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">This Week</h2>
        <Badge className={`${status.className} gap-1 text-xs border-0`}>
          {status.icon}
          {status.label}
        </Badge>
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold">{totalHours}h</p>
                <p className="text-xs text-muted-foreground">of {targetHours}h target</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{remaining}h</p>
                <p className="text-xs text-muted-foreground">remaining</p>
              </div>
            </div>

            <Progress value={progressPercent} className="h-2.5 mb-2" />
            <p className="text-xs text-muted-foreground text-right">{Math.round(progressPercent)}% complete</p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onLogTime}
          className="gap-2"
          size="lg"
          disabled={weekStatus !== "incomplete"}
        >
          <Plus className="w-4 h-4" />
          Log Time
        </Button>
        <Button
          onClick={onSubmitWeek}
          variant="outline"
          className="gap-2"
          size="lg"
          disabled={weekStatus !== "incomplete" || totalHours === 0}
        >
          <Send className="w-4 h-4" />
          Submit Week
        </Button>
      </div>
    </div>
  );
};
