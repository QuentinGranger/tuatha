// In-memory online presence store (ephemeral — no DB needed)
// Tracks last heartbeat timestamp per proId.
// A pro is "online" if their last heartbeat was within ONLINE_TTL_MS.

const ONLINE_TTL_MS = 30_000; // 30 seconds

// Map<proId, lastSeenTimestamp>
const store = new Map<string, number>();

/** Record a heartbeat for a pro (call on every page load / poll) */
export function heartbeat(proId: string): void {
  store.set(proId, Date.now());
}

/** Check if a pro is currently online */
export function isOnline(proId: string): boolean {
  const ts = store.get(proId);
  if (!ts) return false;
  return Date.now() - ts < ONLINE_TTL_MS;
}

/** Get last-seen timestamp for a pro (undefined if never seen) */
export function getLastSeen(proId: string): number | undefined {
  return store.get(proId);
}

/** Get presence info for a pro */
export function getPresence(proId: string): { online: boolean; lastSeen: number | null } {
  const ts = store.get(proId);
  if (!ts) return { online: false, lastSeen: null };
  return { online: Date.now() - ts < ONLINE_TTL_MS, lastSeen: ts };
}
