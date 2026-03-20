import { Home, ListTodo, History, BarChart3, User, Shield, Users, TrendingUp, Building2, CalendarCheck, CalendarDays, Timer, Folder, Send, LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { isSubadmin } from "@/lib/authUtils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles?: string[]; // If empty/undefined, show to all
}

const allNavItems: NavItem[] = [
  { icon: Home, label: "Home", path: "/" },
  { icon: CalendarCheck, label: "Attendance", path: "/attendance" },
  { icon: ListTodo, label: "Tasks", path: "/tasks" },
  { icon: Folder, label: "Projects", path: "/projects" },
  { icon: CalendarDays, label: "Leave", path: "/leave" },
  { icon: Timer, label: "Timesheet", path: "/timesheet" },
  { icon: Send, label: "Requests", path: "/requests" },
  { icon: TrendingUp, label: "Skills", path: "/skills" },
  { icon: History, label: "History", path: "/history" },
  { icon: Users, label: "Team", path: "/manager", roles: ["manager", "team_lead", "hr"] },
  { icon: Building2, label: "Reports", path: "/reports", roles: ["organization"] },
  { icon: Shield, label: "Admin", path: "/admin", roles: ["admin"] },
  { icon: User, label: "Profile", path: "/profile" },
];

export const RoleBasedNav = () => {
  const location = useLocation();
  const { roles, loading } = useUserRoles();
  const { user } = useAuth();
  const userType = (user as { userType?: string } | null)?.userType;

  // Filter nav items based on user roles
  const visibleItems = allNavItems.filter((item) => {
    // Projects: hide for subadmin
    if (item.path === "/projects") {
      return !isSubadmin(user);
    }
    // Team / Manager: show only for MANAGER and SENIOR_MANAGER; hide for EMPLOYEE
    if (item.path === "/manager") {
      return userType === "MANAGER" || userType === "SENIOR_MANAGER";
    }
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((role) => roles.includes(role as string));
  });

  // Limit to 5 items for mobile bottom nav
  const navItems = visibleItems.slice(0, 5);

  if (loading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border shadow-lg z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto py-2 px-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center py-2 gap-1">
              <div className="w-5 h-5 bg-muted rounded animate-pulse" />
              <div className="w-8 h-2 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border shadow-lg z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto py-2 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex-1 flex flex-col items-center py-2 gap-1 rounded-xl transition-all",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-primary"
                    style={{ x: "-50%" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for mobile */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};
