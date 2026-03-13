import { Home, ListTodo, History, BarChart3, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: ListTodo, label: "Tasks", path: "/tasks" },
  { icon: History, label: "History", path: "/history" },
  { icon: BarChart3, label: "Performance", path: "/performance" },
  { icon: User, label: "Profile", path: "/profile" },
];

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="bottom-nav z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn("bottom-nav-item relative flex-1", isActive && "active")}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-primary"
                    style={{ x: "-50%" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn("text-xs font-medium", isActive && "text-primary")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
