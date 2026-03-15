import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, ListTodo, History, BarChart3, User, Shield, Users,
  TrendingUp, Building2, CalendarCheck, CalendarDays, Timer,
  Bell, Settings, LogOut, Zap, FileText, Target, DoorOpen, Folder,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useUnseenTaskCounts } from "@/hooks/useProjectManagement";
import { usePendingRequestsCount } from "@/hooks/useRequests";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles?: string[];
}

interface NavGroup {
  title: string;
  color: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Core Modules",
    color: "text-blue-500",
    items: [
      { icon: Home, label: "Dashboard", path: "/" },
      { icon: ListTodo, label: "Tasks", path: "/tasks" },
      { icon: History, label: "Contributions", path: "/history" },
      { icon: Folder, label: "Projects", path: "/projects" },
    ],
  },
  {
    title: "Workforce Management",
    color: "text-emerald-500",
    items: [
      { icon: CalendarCheck, label: "Attendance", path: "/attendance" },
      { icon: CalendarDays, label: "Leave Management", path: "/leave" },
      { icon: Timer, label: "Timesheets", path: "/timesheet" },
      { icon: DoorOpen, label: "Room Booking", path: "/rooms" },
      { icon: Send, label: "Requests", path: "/requests" },
    ],
  },
  {
    title: "Performance",
    color: "text-amber-500",
    items: [
      { icon: Zap, label: "Skills", path: "/skills" },
      { icon: BarChart3, label: "Performance", path: "/performance" },
      { icon: Building2, label: "Reports", path: "/reports", roles: ["organization"] },
    ],
  },
  {
    title: "Management",
    color: "text-purple-500",
    items: [
      { icon: Users, label: "Team / Manager", path: "/manager", roles: ["manager", "team_lead", "hr"] },
      { icon: Shield, label: "Admin Panel", path: "/admin", roles: ["admin"] },
    ],
  },
  {
    title: "System",
    color: "text-muted-foreground",
    items: [
      { icon: User, label: "Profile", path: "/profile" },
    ],
  },
];

interface NavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NavigationDrawer = ({ open, onOpenChange }: NavigationDrawerProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const { data: unseenCounts } = useUnseenTaskCounts();
  const { data: pendingRequestsCount = 0 } = usePendingRequestsCount();
  const [signingOut, setSigningOut] = useState(false);
  const totalUnseenTasks = (unseenCounts?.projectTaskCount ?? 0) + (unseenCounts?.separateTaskCount ?? 0);
  const userType = (user as { userType?: string } | null)?.userType;
  const showRequestsBadge = (roles.includes("manager") || roles.includes("team_lead") || roles.includes("hr") || roles.includes("admin") || userType === "MANAGER" || userType === "SENIOR_MANAGER") && pendingRequestsCount > 0;

  const handleNavClick = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    setSigningOut(true);
    await signOut();
  };

  if (signingOut) {
    return <ConnectPlusLoader variant="fullscreen" message="Signing out..." />;
  }

  const isVisible = (item: NavItem) => {
    // Team / Manager: show only for MANAGER and SENIOR_MANAGER (external_role); hide for EMPLOYEE
    if (item.path === "/manager") {
      return userType === "MANAGER" || userType === "SENIOR_MANAGER";
    }
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((role) => roles.includes(role as string));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <SheetTitle className="text-left font-display text-lg">
            CacheTask
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Workforce Platform
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 py-2">
          <div className="space-y-4 px-3">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(isVisible);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title}>
                  <p className={cn("text-[11px] font-semibold uppercase tracking-wider px-3 mb-1", group.color)}>
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavClick(item.path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-foreground/70 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="w-4.5 h-4.5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                          <span>{item.label}</span>
                          {item.path === "/tasks" && totalUnseenTasks > 0 && (
                            <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                              {totalUnseenTasks > 99 ? "99+" : totalUnseenTasks}
                            </span>
                          )}
                          {item.path === "/requests" && showRequestsBadge && (
                            <span className="ml-auto bg-amber-500 text-amber-950 text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                              {pendingRequestsCount > 99 ? "99+" : pendingRequestsCount}
                            </span>
                          )}
                          {isActive && (item.path !== "/tasks" || totalUnseenTasks === 0) && (item.path !== "/requests" || !showRequestsBadge) && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Logout */}
        <div className="border-t border-border p-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
