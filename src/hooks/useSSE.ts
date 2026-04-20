"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Generic SSE hook (fetch-based) ───
// Uses fetch() instead of EventSource so we can read HTTP status codes.
// On 401 → stops immediately (no retry).
// On other errors → exponential backoff, stops after MAX_CONSECUTIVE_ERRORS.

const MAX_CONSECUTIVE_ERRORS = 5;
const MAX_BACKOFF_MS = 60_000;

interface UseSSEOptions<T> {
  /** SSE endpoint URL (e.g. "/api/notifications/stream") */
  url: string;
  /** Whether the connection should be active (default: true) */
  enabled?: boolean;
  /** Called on every new event with parsed data */
  onMessage?: (data: T) => void;
  /** Query params appended to URL */
  params?: Record<string, string>;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
}

export function useSSE<T = unknown>({
  url,
  enabled = true,
  onMessage,
  params,
  reconnectDelay = 3000,
}: UseSSEOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);

  // Keep callback ref up to date without re-triggering effect
  onMessageRef.current = onMessage;

  // Stable serialized params string for dependency
  const paramsStr = params ? JSON.stringify(params) : "";

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    consecutiveErrorsRef.current = 0;

    if (!enabled) {
      cleanup();
      return;
    }

    // Build URL with params
    let fullUrl = url;
    if (paramsStr) {
      try {
        const parsed = JSON.parse(paramsStr) as Record<string, string>;
        const sp = new URLSearchParams(parsed);
        fullUrl += (url.includes("?") ? "&" : "?") + sp.toString();
      } catch {}
    }

    const connect = async () => {
      if (!mountedRef.current) return;

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch(fullUrl, { signal: ac.signal });

        // Auth failure → stop completely, never retry
        if (res.status === 401 || res.status === 403) {
          if (mountedRef.current) setConnected(false);
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`SSE: HTTP ${res.status}`);
        }

        // Stream opened successfully
        if (mountedRef.current) {
          setConnected(true);
          consecutiveErrorsRef.current = 0;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done || !mountedRef.current) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline (SSE event boundary)
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const trimmed = part.trim();
            // Skip SSE comments (heartbeats)
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed.startsWith("data: ")) {
              consecutiveErrorsRef.current = 0;
              try {
                const parsed = JSON.parse(trimmed.slice(6)) as T;
                if (mountedRef.current) {
                  setData(parsed);
                  onMessageRef.current?.(parsed);
                }
              } catch {
                // Non-JSON data line, ignore
              }
            }
          }
        }
      } catch (err) {
        // AbortError is expected on cleanup — don't reconnect
        if (err instanceof DOMException && err.name === "AbortError") return;
      }

      // Stream ended or errored — schedule reconnect with backoff
      if (!mountedRef.current) return;
      setConnected(false);

      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) return;

      const backoff = Math.min(
        reconnectDelay * Math.pow(2, consecutiveErrorsRef.current - 1),
        MAX_BACKOFF_MS,
      );
      reconnectTimer.current = setTimeout(connect, backoff);
    };

    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [url, enabled, paramsStr, reconnectDelay, cleanup]);

  return { data, connected };
}
