import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { 
  useNotifications, 
  useMarkAsRead, 
  useMarkAllAsRead, 
  useDeleteNotification,
  useClearAllNotifications 
} from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel = ({ isOpen, onClose }: NotificationPanelProps) => {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();
  const clearAll = useClearAllNotifications();

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: "100%" }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read
              </button>
            )}
            <button
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">No notifications</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You're all caught up! Check back later.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={(id) => markAsRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </>
  );
};
