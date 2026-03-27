import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { NavigationDrawer } from "./NavigationDrawer";
import { TaskDeadlineReminder } from "@/components/tasks/TaskDeadlineReminder";
import { useNotifications } from "@/hooks/useNotifications";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Tasks",
  "/history": "Contributions",
  "/performance": "Performance",
  "/profile": "Profile",
  "/skills": "Skills",
  "/attendance": "Attendance",
  "/leave": "Leave Management",
  "/timesheet": "Timesheet",
  "/rooms": "Room Booking",
  "/projects": "Projects",
  "/manager": "Manager Dashboard",
  "/reports": "Reports",
  "/admin": "Admin Panel",
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications();

  const pageTitle = pageTitles[location.pathname] || "CacheTask";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          <h1 className="text-base font-display font-semibold">{pageTitle}</h1>

          <NotificationBell onClick={openDrawer} unreadCount={unreadCount} />
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-8 min-h-[60vh] text-foreground">
        {children}
      </main>

      <NavigationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <NotificationDrawer
        notifications={notifications}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onRetry={refetch}
      />

      <TaskDeadlineReminder />
    </div>
  );
};
