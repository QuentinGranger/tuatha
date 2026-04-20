// In-memory typing indicator store (ephemeral — no DB needed)
// Each entry: senderProId → receiverProId → timestamp
// Typing status expires after TYPING_TTL_MS

const TYPING_TTL_MS = 4000; // 4 seconds

// Map<receiverProId, Map<senderProId, expiresAt>>
const store = new Map<string, Map<string, number>>();

/** Mark a pro as typing to another pro */
export function setTyping(senderProId: string, receiverProId: string): void {
  if (!store.has(receiverProId)) {
    store.set(receiverProId, new Map());
  }
  store.get(receiverProId)!.set(senderProId, Date.now() + TYPING_TTL_MS);
}

/** Get list of proIds currently typing to a given pro */
export function getTypingFor(receiverProId: string): string[] {
  const senders = store.get(receiverProId);
  if (!senders) return [];
  const now = Date.now();
  const active: string[] = [];
  for (const [senderId, expiresAt] of senders) {
    if (expiresAt > now) {
      active.push(senderId);
    } else {
      senders.delete(senderId);
    }
  }
  if (senders.size === 0) store.delete(receiverProId);
  return active;
}

/** Clear typing status (e.g. when message is sent) */
export function clearTyping(senderProId: string, receiverProId: string): void {
  const senders = store.get(receiverProId);
  if (senders) {
    senders.delete(senderProId);
    if (senders.size === 0) store.delete(receiverProId);
  }
}
