import { motion } from "framer-motion";
import { CalendarPlus, Palmtree, HeartPulse, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LeaveBalance } from "@/hooks/useLeaveManagement";

const iconMap: Record<string, React.ReactNode> = {
  CL: <Palmtree className="w-5 h-5" />,
  SL: <HeartPulse className="w-5 h-5" />,
  EL: <Award className="w-5 h-5" />,
};

const colorMap: Record<string, string> = {
  CL: "bg-primary/10 text-primary",
  SL: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

interface Props {
  balances: LeaveBalance[];
  onApplyLeave: () => void;
}

export const LeaveBalanceCards = ({ balances, onApplyLeave }: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Leave Balances</h2>
        <span className="text-xs text-muted-foreground">FY 2025–26</span>
      </div>

      <div className="grid gap-3">
        {balances.map((b, i) => {
          const usedPercent = (b.used / b.total) * 100;
          return (
            <motion.div
              key={b.code}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-xl ${colorMap[b.code] || "bg-muted"}`}>
                      {iconMap[b.code]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{b.type}</p>
                      <p className="text-xs text-muted-foreground">{b.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{b.remaining}</p>
                      <p className="text-xs text-muted-foreground">remaining</p>
                    </div>
                  </div>
                  <Progress value={usedPercent} className="h-2" />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Used: {b.used}</span>
                    <span>Total: {b.total}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Button onClick={onApplyLeave} className="w-full gap-2 mt-2" size="lg">
        <CalendarPlus className="w-4 h-4" />
        Apply Leave
      </Button>
    </div>
  );
};
