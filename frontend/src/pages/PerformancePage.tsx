import { motion } from "framer-motion";
import { Users, CheckCircle, AlertTriangle, Clock, TrendingUp, BookOpen } from "lucide-react";
import { ScoreCircle } from "@/components/ui/ScoreCircle";
import { MetricCard } from "@/components/cards/MetricCard";
import { usePerformance, PerformanceData } from "@/hooks/usePerformance";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const PerformancePage = () => {
  const { data, isLoading, error } = usePerformance("me");
  const currentMonth = new Date()
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();

  if (isLoading) {
    return <ConnectPlusLoader variant="inline" message="Calculating performance..." />;
  }

  const perf = (data as PerformanceData) || {
    overallScore: 0,
    attendanceScore: 0,
    taskCompletionScore: 0,
    overduePenalty: 0,
    collaborationScore: 0,
    skillsScore: 0,
  };

  const getInsight = () => {
    const scores = [
      { label: "Attendance", value: perf.attendanceScore },
      { label: "Task Completion", value: perf.taskCompletionScore },
      { label: "Collaboration", value: perf.collaborationScore },
      { label: "Skills", value: perf.skillsScore },
    ];
    const best = scores.reduce((a, b) => (a.value > b.value ? a : b));
    const worst = scores.reduce((a, b) => (a.value < b.value ? a : b));

    if (perf.overallScore >= 80) {
      return `Excellent performance! Your strongest area is ${best.label}. Keep it up!`;
    } else if (perf.overallScore >= 60) {
      return `Good progress! Focus on improving ${worst.label} to boost your overall score.`;
    }
    return `There's room for growth. Start by improving ${worst.label} for the biggest impact.`;
  };

  const metrics = [
    { icon: Clock, label: "Attendance", value: perf.attendanceScore, weight: "25%" },
    { icon: CheckCircle, label: "Task Completion", value: perf.taskCompletionScore, weight: "30%" },
    { icon: AlertTriangle, label: "Overdue Penalty", value: Math.abs(perf.overduePenalty), weight: "-20%" },
    { icon: Users, label: "Collaboration", value: perf.collaborationScore, weight: "15%" },
    { icon: BookOpen, label: "Skills", value: perf.skillsScore, weight: "10%" },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants} className="flex justify-center pt-4">
        <ScoreCircle score={perf.overallScore} label="PERFORMANCE" />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Performance Insight</h3>
            <p className="text-sm text-muted-foreground mt-1">{error ? "Unable to calculate performance at this time." : getInsight()}</p>
          </div>
        </div>
      </motion.div>

      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Score Breakdown</h3>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">{currentMonth}</span>
        </div>
        <div className="space-y-2">
          {metrics.map((metric, index) => (
            <motion.div key={metric.label} variants={itemVariants} transition={{ delay: index * 0.1 }}>
              <div className="relative">
                <MetricCard
                  icon={metric.icon}
                  label={metric.label}
                  value={metric.value}
                  variant={metric.label === "Overdue Penalty" ? "warning" : metric.value >= 70 ? "success" : "default"}
                />
                <span className="absolute top-3 right-3 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {metric.weight}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default PerformancePage;
