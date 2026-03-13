import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning";
  className?: string;
  animated?: boolean;
}

export const ProgressBar = ({
  value,
  max = 100,
  showValue = false,
  size = "md",
  variant = "default",
  className,
  animated = true,
}: ProgressBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const variantClasses = {
    default: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <div className={cn("flex items-center gap-3 w-full", className)}>
      <div className={cn("progress-bar flex-1", sizeClasses[size])}>
        <motion.div
          className={cn("progress-bar-fill", variantClasses[variant])}
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      {showValue && (
        <span className="text-sm font-medium text-foreground min-w-[2.5rem] text-right">
          {value}
        </span>
      )}
    </div>
  );
};
