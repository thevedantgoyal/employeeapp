import { Bell } from "lucide-react";

interface NotificationBellProps {
  onClick: () => void;
  unreadCount?: number;
}

export const NotificationBell = ({ onClick, unreadCount = 0 }: NotificationBellProps) => {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-muted transition-colors"
      title="Notifications"
    >
      <Bell className="w-5 h-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};
