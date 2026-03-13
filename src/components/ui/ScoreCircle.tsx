import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export const ScoreCircle = ({
  score,
  maxScore = 100,
  size = 180,
  strokeWidth = 8,
  label = "FOCUS SCORE",
  className,
}: ScoreCircleProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((score / maxScore) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("score-circle", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-circle-bg"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-circle-fill"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-display font-bold text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-xs tracking-widest text-muted-foreground uppercase mt-1">
          {label}
        </span>
      </div>
    </div>
  );
};
