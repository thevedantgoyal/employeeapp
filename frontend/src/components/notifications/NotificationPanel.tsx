import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDrawer } from "@/components/NotificationDrawer";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel = ({ isOpen, onClose }: NotificationPanelProps) => {
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

  if (isOpen && !isDrawerOpen) openDrawer();
  if (!isOpen && isDrawerOpen) closeDrawer();

  return (
    <NotificationDrawer
      notifications={notifications}
      unreadCount={unreadCount}
      loading={loading}
      error={error}
      isOpen={isOpen}
      onClose={onClose}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onRetry={refetch}
    />
  );
};
