import { Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Notification } from "@/hooks/useNotifications";

interface Props {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => Promise<void> | void;
  onMarkAllAsRead: () => Promise<void> | void;
  onRetry: () => Promise<void> | void;
}

function getRelativeTime(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (h < 48) return "yesterday";
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

function accentColor(type: string): string {
  if (type.includes("task")) return "var(--color-task, var(--primary))";
  if (type.includes("leave")) return "var(--color-leave, var(--primary))";
  if (type.includes("request")) return "var(--color-request, var(--primary))";
  if (type.includes("room")) return "var(--color-room, var(--primary))";
  if (type.includes("wish")) return "var(--color-wish, var(--primary))";
  if (type.includes("project")) return "var(--color-project, var(--primary))";
  return "var(--color-muted-accent, var(--muted-foreground))";
}

export function NotificationDrawer({
  notifications,
  unreadCount,
  loading,
  error,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onRetry,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-background/70 transition-opacity duration-200 md:bg-background/50 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full md:w-[380px] bg-background border-l border-border transition-transform duration-250 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"} flex flex-col`}
        style={{ maxWidth: "100%" }}
      >
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">{unreadCount} unread</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button className="text-sm text-primary" onClick={onMarkAllAsRead}>Mark all as read</button>
              )}
              <button className="p-2 rounded-full hover:bg-muted min-h-[44px] min-w-[44px]" onClick={onClose}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/5 mb-2" />
                  <div className="h-3 bg-muted rounded w-full mb-1" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">Could not load notifications. Tap to retry.</p>
              <button className="text-sm text-primary" onClick={onRetry}>Retry</button>
            </div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium">You're all caught up!</p>
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}

          {!error && notifications.length > 0 && (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`w-full text-left border-b border-border min-h-[44px] ${n.is_read ? "bg-background" : "bg-muted/40"}`}
                  onClick={async () => {
                    if (!n.is_read) await onMarkAsRead(n.id);
                    if (n.link) {
                      onClose();
                      navigate(n.link);
                    }
                  }}
                >
                  <div className="flex">
                    <div className="w-1 rounded-l-md" style={{ backgroundColor: accentColor(n.type) }} />
                    <div className="flex-1 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{n.title}</p>
                        {!n.is_read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{getRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
