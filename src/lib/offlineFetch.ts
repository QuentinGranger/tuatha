"use client";

// ─── Offline-aware Fetch Wrapper ───
// Wraps native fetch to queue failed mutations when offline.

import { enqueue } from "./offlineQueue";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// API routes that should be queued when offline (whitelist)
const QUEUEABLE_ROUTES = [
  "/api/reseau/messages",
  "/api/notifications",
  "/api/athlete/messages",
  "/api/athlete/groups",
];

function isQueueable(url: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return false;
  return QUEUEABLE_ROUTES.some((route) => url.includes(route));
}

/**
 * Offline-aware fetch. For mutation requests to whitelisted routes:
 * - If online, sends normally.
 * - If offline (or network error), queues the request for later replay.
 * - Returns a synthetic Response so the caller doesn't crash.
 */
export async function offlineFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || "GET").toUpperCase();

  try {
    const response = await fetch(input, init);
    return response;
  } catch (err) {
    // Network error — check if we should queue this mutation
    if (isQueueable(url, method)) {
      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => { headers[k] = v; });
        } else {
          Object.assign(headers, init.headers);
        }
      }

      await enqueue({
        url,
        method,
        headers,
        body: typeof init?.body === "string" ? init.body : null,
      });

      // Return synthetic "queued" response
      return new Response(JSON.stringify({ queued: true, offline: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Not queueable — rethrow
    throw err;
  }
}
