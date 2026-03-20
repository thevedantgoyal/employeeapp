import { Bell, BellOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

export const PushNotificationToggle = () => {
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } =
    usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success("Push notifications disabled");
      } else {
        toast.error("Failed to disable push notifications");
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success("Push notifications enabled! You'll receive alerts for new tasks and updates.");
      } else if (permission === "denied") {
        toast.error("Notification permission denied. Please enable in browser settings.");
      } else {
        toast.error("Failed to enable push notifications");
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label className="text-sm font-medium">Push Notifications</Label>
            <p className="text-xs text-muted-foreground">
              Not supported in this browser
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label className="text-sm font-medium">Push Notifications</Label>
          <p className="text-xs text-muted-foreground">
            {isSubscribed
              ? "Receive alerts for tasks and reviews"
              : "Get notified of new tasks and updates"}
          </p>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      )}
    </div>
  );
};
