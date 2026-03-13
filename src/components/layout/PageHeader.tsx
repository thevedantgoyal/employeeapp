import { ChevronLeft, Settings, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  showMenu?: boolean;
  showNotifications?: boolean;
  onNotificationClick?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  showBack = false,
  showSettings = false,
  showMenu = false,
  showNotifications = false,
  onNotificationClick,
  rightElement,
  className,
}: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className={cn("flex items-center justify-between py-4", className)}>
      <div className="w-10">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {showMenu && (
          <button className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <h1 className="text-xl font-display font-bold">{title}</h1>
      
      <div className="flex items-center gap-1">
        {showNotifications && onNotificationClick && (
          <NotificationBell onClick={onNotificationClick} />
        )}
        {showSettings && (
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {rightElement}
        {!showNotifications && !showSettings && !rightElement && <div className="w-10" />}
      </div>
    </header>
  );
};
