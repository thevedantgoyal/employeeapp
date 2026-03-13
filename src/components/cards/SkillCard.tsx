import { LucideIcon, CheckCircle2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  icon: LucideIcon;
  title: string;
  lastUpdate: string;
  currentValue: number;
  goalValue: number;
  showSuggestedLearning?: boolean;
  goalMet?: boolean;
  className?: string;
}

export const SkillCard = ({
  icon: Icon,
  title,
  lastUpdate,
  currentValue,
  goalValue,
  showSuggestedLearning = false,
  goalMet = false,
  className,
}: SkillCardProps) => {
  const percentage = (currentValue / goalValue) * 100;
  const variant = goalMet || percentage >= 100 ? "success" : "default";

  return (
    <div className={cn("bg-card rounded-2xl p-4 shadow-soft border border-border/50", className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{title}</h4>
            <p className="text-xs text-muted-foreground">{lastUpdate}</p>
          </div>
        </div>
        {goalMet ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="w-4 h-4" />
            Goal Met
          </span>
        ) : showSuggestedLearning ? (
          <span className="status-badge status-badge-pending text-xs">
            Suggested Learning
          </span>
        ) : null}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current: {currentValue}%</span>
          <span className="text-muted-foreground">Goal: {goalValue}%</span>
        </div>
        <div className="relative">
          <ProgressBar value={currentValue} max={100} variant={variant} size="md" />
          <div 
            className="absolute top-0 h-full w-0.5 bg-muted-foreground/40"
            style={{ left: `${goalValue}%` }}
          />
        </div>
      </div>
    </div>
  );
};
