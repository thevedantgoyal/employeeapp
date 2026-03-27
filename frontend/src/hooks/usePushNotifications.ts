import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";
import { api, authApi } from "@/integrations/api/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "default";
  isLoading: boolean;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
    isLoading: true,
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    
    return isSupported;
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!checkSupport() || !user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      setState({
        isSupported: true,
        isSubscribed: !!subscription,
        permission: Notification.permission,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking push subscription:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [checkSupport, user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) {
      console.error("Cannot subscribe: missing user or VAPID key");
      return false;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({ 
          ...prev, 
          permission, 
          isLoading: false 
        }));
        return false;
      }

      // Register push service worker
      const registration = await navigator.serviceWorker.register("/sw-push.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      const subscriptionJson = subscription.toJSON();

      // Save subscription to database
      const { error } = await db.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh,
        auth: subscriptionJson.keys!.auth,
      }, {
        onConflict: "user_id,endpoint",
      });

      if (error) {
        console.error("Error saving subscription:", error);
        throw error;
      }

      setState({
        isSupported: true,
        isSubscribed: true,
        permission: "granted",
        isLoading: false,
      });

      console.log("Push subscription successful");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await db
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      console.log("Push unsubscription successful");
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
};

// Helper function to send push notification (for use in other hooks)
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  options?: { url?: string; tag?: string }
) => {
  try {
    const { data, error } = await db.functions.invoke("send-push", {
      body: {
        user_id: userId,
        title,
        body,
        url: options?.url,
        tag: options?.tag,
      },
    });

    if (error) {
      console.error("Failed to send push notification:", error);
      return false;
    }

    console.log("Push notification sent:", data);
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotificationsBootstrap(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function setupPush() {
      try {
        const session = await authApi.getSession();
        if (session.error || !session.data?.user) return;

        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (Notification.permission === "denied") return;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const { data, error } = await api.get<{ publicKey: string }>("/push/vapid-public-key");
        if (error || !data?.publicKey) return;

        const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        }
        await api.post("/push/subscribe", subscription.toJSON());
      } catch (err) {
        console.warn("Push setup failed:", err);
      }
    }

    setupPush();
  }, [isAuthenticated]);
}
