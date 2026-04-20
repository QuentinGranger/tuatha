"use client";

import { useState, useEffect, useCallback } from "react";
import { replayAll, count } from "@/lib/offlineQueue";

/**
 * Hook to detect online/offline status and manage the sync queue.
 * - `isOffline`: true when the browser has no network connection.
 * - `pendingCount`: number of queued mutations waiting to sync.
 * - `replayQueue`: manually trigger sync replay.
 * - `syncing`: true while replaying.
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Check initial state
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    count().then(setPendingCount).catch(() => {});
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      // Auto-replay when back online
      replayQueue();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for SW background sync message
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "REPLAY_SYNC_QUEUE") {
        replayQueue();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replayQueue = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await replayAll();
      const remaining = await count();
      setPendingCount(remaining);
      // Notify messagerie pages to refetch after successful sync
      if (result.sent > 0) {
        window.dispatchEvent(new CustomEvent("tuatha-sync-complete", { detail: result }));
      }
    } catch {
      // still offline
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Refresh pending count periodically when offline
  useEffect(() => {
    if (!isOffline) return;
    const interval = setInterval(() => {
      count().then(setPendingCount).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [isOffline]);

  return { isOffline, pendingCount, syncing, replayQueue };
}
