import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, CheckCircle, Clock, TrendingUp, ListTodo, Users, SearchCheck, Send, Inbox } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";
import { TaskCard } from "@/components/cards/TaskCard";
import { MetricCard } from "@/components/cards/MetricCard";
import { AddWorkUpdateModal } from "@/components/modals/AddWorkUpdateModal";
import { useHomeTasks, useHomeStats } from "@/hooks/useHomeData";
import { formatTaskDueLabel } from "@/hooks/useTasks";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useMyRequests, usePendingRequestsCount } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { isSubadmin } from "@/lib/authUtils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  const { hasAnyRole, loading: rolesLoading } = useUserRoles();
  const { data: tasks, isLoading: tasksLoading } = useHomeTasks();
  const { data: stats, isLoading: statsLoading } = useHomeStats();
  const { data: myRequests = [], refetch: refetchMyRequests } = useMyRequests();
  const { data: pendingRequestsCount = 0, refetch: refetchPendingCount } = usePendingRequestsCount();

  const canReviewContributions = hasAnyRole(["manager", "team_lead", "hr", "admin"]);
  const myPendingCount = myRequests.filter((r) => r.status === "pending").length;
  const userType = (user as { userType?: string } | null)?.userType;
  const isSeniorManager = isSubadmin(user);
  const isManager = userType === "MANAGER";
  const showFab = isSeniorManager || isManager;
  const fabLabel = useMemo(() => {
    if (isSeniorManager) return "Open task template";
    if (isManager) return "Open manager section";
    return "Add work update";
  }, [isSeniorManager, isManager]);

  // Refetch request counts when dashboard gains focus (e.g. user navigates back)
  useEffect(() => {
    const onFocus = () => {
      refetchMyRequests();
      if (canReviewContributions) refetchPendingCount();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [canReviewContributions, refetchMyRequests, refetchPendingCount]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data: profileData } = await db
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileData?.full_name && typeof profileData.full_name === "string") {
          setProfileName(profileData.full_name.trim().split(/\s+/)[0] || null);
        }
      } catch {
        setProfileName(null);
      }
    };
    fetchProfile();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handleFabClick = () => {
    if (isSeniorManager) {
      navigate("/manager?tab=tasks&create=1");
      return;
    }
    if (isManager) {
      navigate("/manager");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Greeting */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-display font-bold">
            {getGreeting()}, {profileName || "there"}
          </h1>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
          {statsLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : (
            <>
              <Link to="/tasks?status=in_progress">
                <MetricCard label="Active Tasks" value={stats?.activeTasks ?? 0} maxValue={10} icon={ListTodo} showInfo={false} />
              </Link>
              <Link to="/tasks?status=pending">
                <MetricCard label="Pending" value={stats?.pending ?? 0} maxValue={10} icon={Clock} variant="warning" showInfo={false} />
              </Link>
              <Link to="/tasks?status=completed">
                <MetricCard label="Completed" value={stats?.completed ?? 0} maxValue={20} icon={CheckCircle} variant="success" showInfo={false} />
              </Link>
              <Link to="/tasks?status=approved">
                <MetricCard label="Done Approved" value={stats?.approved ?? 0} maxValue={20} icon={TrendingUp} variant="success" showInfo={false} />
              </Link>
              <Link to="/tasks?status=review">
                <MetricCard label="In Review" value={stats?.inReview ?? 0} maxValue={10} icon={SearchCheck} variant="info" showInfo={false} />
              </Link>
              {canReviewContributions ? (
                <Link to="/requests?filter=pending">
                  <MetricCard label="Pending Requests" value={pendingRequestsCount} maxValue={Math.max(pendingRequestsCount, 10)} icon={Send} variant="warning" showInfo={false} />
                </Link>
              ) : (
                <Link to="/requests?tab=my">
                  <MetricCard label="My Requests" value={myPendingCount} maxValue={Math.max(myPendingCount, 10)} icon={Inbox} variant="info" showInfo={false} />
                </Link>
              )}
            </>
          )}
        </motion.div>

        {/* Manager Quick Access */}
        {!rolesLoading && canReviewContributions && (
          <motion.div variants={itemVariants}>
            <Link
              to="/manager"
              className="block bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 rounded-2xl p-5 border border-primary/20 hover:border-primary/40 hover:shadow-card transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Manager Dashboard</h3>
                  <p className="text-sm text-muted-foreground mt-1">Review contributions & manage tasks</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Today's Tasks */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Tasks</h3>
            <Link to="/tasks" className="text-sm text-primary font-medium">View all</Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <motion.div key={task.id} variants={itemVariants} transition={{ delay: index * 0.1 }}>
                  <Link to={`/tasks/${task.id}`}>
                    <TaskCard
                      title={task.title}
                      description={task.description || undefined}
                      project={task.project_name || "No Project"}
                      dueLabel={formatTaskDueLabel(task)}
                      dueDate={task.due_date}
                      taskDate={task.task_date}
                      durationHours={task.duration_hours}
                      priority={task.priority}
                      status={task.status}
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/50 rounded-2xl">
              <p className="text-muted-foreground">No tasks assigned</p>
              <p className="text-sm text-muted-foreground mt-1">Tasks will appear here when assigned</p>
            </div>
          )}
        </motion.section>
      </motion.div>

      {/* FAB */}
      {showFab && (
        <motion.button
          className="fixed bottom-6 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          onClick={handleFabClick}
          aria-label={fabLabel}
          title={fabLabel}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}

      <AddWorkUpdateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default Index;
