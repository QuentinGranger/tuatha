"use client";

// ─── Inactivity Timeout ───
// Automatically redirects the user after a period of inactivity on sensitive pages.
// Listens for mouse, keyboard, scroll, and touch events to reset the timer.
//
// Usage:
//   useInactivityTimeout({ timeoutMs: 15 * 60 * 1000, redirectTo: "/" });

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface InactivityOptions {
  timeoutMs?: number;
  redirectTo?: string;
  onTimeout?: () => void;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function useInactivityTimeout(options: InactivityOptions = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    redirectTo = "/",
    onTimeout,
  } = options;

  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(() => {
    // Clear session cookie client-side (server will also reject expired sessions)
    document.cookie = "tuatha_access=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "tuatha_session=; path=/; max-age=0; SameSite=Lax";

    if (onTimeout) {
      onTimeout();
    }

    router.replace(redirectTo);
  }, [redirectTo, onTimeout, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs]);

  useEffect(() => {
    // Start initial timer
    resetTimer();

    // Register activity listeners
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}
