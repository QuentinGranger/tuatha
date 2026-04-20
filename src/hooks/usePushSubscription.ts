"use client";

import { useEffect, useRef, useCallback } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Hook to manage Web Push subscription.
 * Automatically subscribes the user on mount if permission is granted.
 * Call `requestPermission()` to prompt the user and subscribe.
 */
export function usePushSubscription() {
  const subscribedRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      // Already subscribed — sync to server
      if (existing) {
        if (!subscribedRef.current) {
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: existing.toJSON() }),
          });
          subscribedRef.current = true;
        }
        return;
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      subscribedRef.current = true;
    } catch {
      // Permission denied or SW not ready — silently fail
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await subscribe();
      return true;
    }
    return false;
  }, [subscribe]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      subscribedRef.current = false;
    } catch {
      // silently fail
    }
  }, []);

  // Auto-subscribe if permission already granted
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!VAPID_PUBLIC_KEY) return;
    if (Notification.permission === "granted") {
      subscribe();
    }
  }, [subscribe]);

  return { requestPermission, unsubscribe, subscribe };
}
