import { formatDistanceToNow } from "date-fns";
import { 
  CheckCircle, 
  XCircle, 
  UserCog, 
  ClipboardList, 
  Users, 
  Info,
  Trash2,
  Check
} from "lucide-react";
import { motion } from "framer-motion";
import { Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const typeIcons = {
  task_assigned: ClipboardList,
  contribution_approved: CheckCircle,
  contribution_rejected: XCircle,
  role_changed: UserCog,
  team_assigned: Users,
  general: Info,
};

const typeColors = {
  task_assigned: "text-primary",
  contribution_approved: "text-green-500",
  contribution_rejected: "text-destructive",
  role_changed: "text-purple-500",
  team_assigned: "text-blue-500",
  general: "text-muted-foreground",
};

export const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) => {
  const Icon = typeIcons[notification.type] || Info;
  const iconColor = typeColors[notification.type] || "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        "p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("mt-0.5", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              "text-sm font-medium truncate",
              !notification.read && "text-foreground",
              notification.read && "text-muted-foreground"
            )}>
              {notification.title}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="w-3 h-3" />
                Mark as read
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
