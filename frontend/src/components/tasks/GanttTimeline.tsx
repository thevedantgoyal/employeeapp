import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GanttTask {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  status: string | null;
  priority: string | null;
  progress: number;
  dependencies: string[];
}

interface GanttTimelineProps {
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
}

type ViewMode = "Day" | "Week" | "Month";

const statusColors: Record<string, string> = {
  pending: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  review: "hsl(38, 92%, 50%)",
  blocked: "hsl(var(--destructive))",
  completed: "hsl(142, 71%, 45%)",
  approved: "hsl(142, 71%, 35%)",
};

export const GanttTimeline = ({ tasks, onTaskClick }: GanttTimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter out tasks without dates
  const validTasks = tasks.filter(t => t.start && t.end);

  if (validTasks.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
        <p className="text-muted-foreground text-sm">
          No tasks with date ranges to display. Tasks need both a start and due date for the Gantt view.
        </p>
      </div>
    );
  }

  // Calculate date range
  const allDates = validTasks.flatMap(t => [new Date(t.start!), new Date(t.end!)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  // Add padding
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 7);

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const dayWidth = viewMode === "Day" ? 40 : viewMode === "Week" ? 20 : 8;
  const chartWidth = Math.max(totalDays * dayWidth, 600);
  const rowHeight = 36;
  const headerHeight = 50;
  const labelWidth = 200;
  const chartHeight = headerHeight + validTasks.length * rowHeight + 20;

  const getX = (date: Date) => {
    const days = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return labelWidth + days * dayWidth;
  };

  // Generate date labels
  const dateLabels: { date: Date; label: string }[] = [];
  const stepDays = viewMode === "Day" ? 1 : viewMode === "Week" ? 7 : 30;
  const cursor = new Date(minDate);
  while (cursor <= maxDate) {
    dateLabels.push({
      date: new Date(cursor),
      label: viewMode === "Month"
        ? cursor.toLocaleDateString("en", { month: "short", year: "2-digit" })
        : cursor.toLocaleDateString("en", { month: "short", day: "numeric" }),
    });
    cursor.setDate(cursor.getDate() + stepDays);
  }

  // Today line
  const today = new Date();
  const todayX = getX(today);
  const showToday = today >= minDate && today <= maxDate;

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 w-fit">
        {(["Day", "Week", "Month"] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === mode
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="overflow-x-auto bg-card rounded-xl border border-border/50">
        <svg
          ref={svgRef}
          width={chartWidth + labelWidth}
          height={chartHeight}
          className="font-sans"
        >
          {/* Header background */}
          <rect x={0} y={0} width={chartWidth + labelWidth} height={headerHeight} fill="hsl(var(--muted) / 0.3)" />

          {/* Date labels */}
          {dateLabels.map((dl, i) => (
            <g key={i}>
              <line
                x1={getX(dl.date)}
                y1={headerHeight}
                x2={getX(dl.date)}
                y2={chartHeight}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
              />
              <text
                x={getX(dl.date) + 4}
                y={headerHeight - 10}
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
              >
                {dl.label}
              </text>
            </g>
          ))}

          {/* Today line */}
          {showToday && (
            <>
              <line
                x1={todayX}
                y1={headerHeight}
                x2={todayX}
                y2={chartHeight}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="4,2"
              />
              <text x={todayX + 4} y={headerHeight - 10} fontSize={10} fill="hsl(var(--primary))" fontWeight="bold">
                Today
              </text>
            </>
          )}

          {/* Task rows */}
          {validTasks.map((task, i) => {
            const y = headerHeight + i * rowHeight;
            const startX = getX(new Date(task.start!));
            const endX = getX(new Date(task.end!));
            const barWidth = Math.max(endX - startX, 8);
            const color = statusColors[task.status || "pending"] || statusColors.pending;

            return (
              <g
                key={task.id}
                className="cursor-pointer"
                onClick={() => onTaskClick?.(task.id)}
              >
                {/* Row background */}
                <rect
                  x={0}
                  y={y}
                  width={chartWidth + labelWidth}
                  height={rowHeight}
                  fill={i % 2 === 0 ? "transparent" : "hsl(var(--muted) / 0.15)"}
                />

                {/* Task label */}
                <text
                  x={8}
                  y={y + rowHeight / 2 + 4}
                  fontSize={11}
                  fill="hsl(var(--foreground))"
                  className="truncate"
                >
                  {task.title.length > 22 ? task.title.slice(0, 22) + "…" : task.title}
                </text>

                {/* Bar background */}
                <rect
                  x={startX}
                  y={y + 8}
                  width={barWidth}
                  height={rowHeight - 16}
                  rx={4}
                  fill={color}
                  opacity={0.2}
                />

                {/* Bar progress */}
                <rect
                  x={startX}
                  y={y + 8}
                  width={barWidth * (task.progress / 100)}
                  height={rowHeight - 16}
                  rx={4}
                  fill={color}
                  opacity={0.8}
                />

                {/* Hover effect */}
                <rect
                  x={startX}
                  y={y + 8}
                  width={barWidth}
                  height={rowHeight - 16}
                  rx={4}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={1}
                  className="hover:stroke-2"
                />
              </g>
            );
          })}

          {/* Dependency arrows */}
          {validTasks.map(task => {
            if (task.dependencies.length === 0) return null;
            const taskIndex = validTasks.findIndex(t => t.id === task.id);
            const taskY = headerHeight + taskIndex * rowHeight + rowHeight / 2;
            const taskStartX = getX(new Date(task.start!));

            return task.dependencies.map(depId => {
              const depIndex = validTasks.findIndex(t => t.id === depId);
              if (depIndex === -1) return null;
              const dep = validTasks[depIndex];
              const depY = headerHeight + depIndex * rowHeight + rowHeight / 2;
              const depEndX = getX(new Date(dep.end!));

              return (
                <g key={`${depId}-${task.id}`}>
                  <path
                    d={`M ${depEndX} ${depY} L ${depEndX + 10} ${depY} L ${depEndX + 10} ${taskY} L ${taskStartX} ${taskY}`}
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="3,2"
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            });
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
};
