"use client";

// ─── Offline Sync Queue ───
// Stores failed mutations in IndexedDB and replays them when back online.

const DB_NAME = "tuatha_offline";
const DB_VERSION = 1;
const STORE_NAME = "syncQueue";

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a failed request to the sync queue. */
export async function enqueue(req: Omit<QueuedRequest, "id" | "timestamp" | "retries">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const entry: QueuedRequest = {
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  store.put(entry);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Get all queued requests, oldest first. */
export async function getAll(): Promise<QueuedRequest[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const items = (req.result as QueuedRequest[]).sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Remove a queued request by id. */
export async function remove(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Get the number of queued requests. */
export async function count(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Clear all queued requests. */
export async function clear(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const MAX_RETRIES = 5;

/**
 * Replay all queued requests sequentially.
 * Returns the number of successfully replayed requests.
 */
export async function replayAll(): Promise<{ sent: number; failed: number }> {
  const items = await getAll();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (res.ok || res.status < 500) {
        // Success or client error (no point retrying 4xx)
        await remove(item.id);
        sent++;
      } else {
        // Server error — keep in queue for later retry
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          await remove(item.id); // give up after max retries
          failed++;
        }
      }
    } catch {
      // Still offline — stop replaying
      failed += items.length - sent - failed;
      break;
    }
  }

  return { sent, failed };
}
