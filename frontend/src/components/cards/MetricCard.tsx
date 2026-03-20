import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  maxValue?: number;
  showInfo?: boolean;
  variant?: "default" | "success" | "warning" | "info";
  className?: string;
}

const variantStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-500",
  warning: "bg-yellow-500/10 text-yellow-500",
  info: "bg-blue-500/10 text-blue-500",
};

export const MetricCard = ({
  icon: Icon,
  label,
  value,
  maxValue = 100,
  showInfo = true,
  variant = "default",
  className,
}: MetricCardProps) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 shadow-soft border border-border/50",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-xl", variantStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
        {showInfo && (
          <Info className="w-4 h-4 text-muted-foreground/40" />
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      
      {/* Progress Bar */}
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
          className={cn(
            "h-full rounded-full transition-all",
            variant === "success" && "bg-green-500",
            variant === "warning" && "bg-yellow-500",
            variant === "info" && "bg-blue-500",
            variant === "default" && "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
