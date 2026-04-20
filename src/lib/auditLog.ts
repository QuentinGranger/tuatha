// ─── Audit Log: Non-Repudiation for Messages & Notes ───
//
// Records structured audit entries for every modification or deletion.
// Stores a snapshot of the original content BEFORE the change, so that
// deleted/edited data can always be recovered and attributed.
//
// Storage: in-memory ring buffer (last 10K entries) + structured console
// logs for production log aggregation (CloudWatch, Datadog, etc.).
//
// Usage:
//   audit.logDelete("message", msgId, userId, { content, senderProId, receiverProId });
//   audit.logUpdate("collabNote", noteId, userId, { before: oldContent, after: newContent, field: "pinned" });
//   audit.logCreate("collabNote", noteId, userId, { content, athleteId });

// ─── Types ───

export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "message" | "collabNote" | "athleteNote" | "connection" | "invitation" | "reaction" | "cabinet" | "cabinetMember" | "offboarding";

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  actorProId: string;
  snapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ─── Ring Buffer ───

const MAX_ENTRIES = 10_000;
const entries: AuditEntry[] = [];
let entryCounter = 0;

function generateId(): string {
  entryCounter++;
  return `audit_${Date.now()}_${entryCounter}`;
}

function pushEntry(entry: AuditEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

// ─── Core logging ───

function log(
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  actorProId: string,
  snapshot: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): AuditEntry {
  const entry: AuditEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    entity,
    entityId,
    actorProId,
    snapshot,
    metadata,
  };

  pushEntry(entry);

  // Structured console log for production log aggregation
  console.log(
    `[AUDIT] ${entry.action.toUpperCase()} ${entry.entity} id=${entry.entityId} by=${entry.actorProId}`,
    JSON.stringify(entry.snapshot),
  );

  return entry;
}

// ─── Public API ───

export const audit = {
  /**
   * Log a creation event.
   * Snapshot should contain the created content.
   */
  logCreate(
    entity: AuditEntity,
    entityId: string,
    actorProId: string,
    snapshot: Record<string, unknown>,
  ): AuditEntry {
    return log("create", entity, entityId, actorProId, snapshot);
  },

  /**
   * Log an update event.
   * Snapshot should contain { field, before, after } for each changed field.
   */
  logUpdate(
    entity: AuditEntity,
    entityId: string,
    actorProId: string,
    snapshot: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): AuditEntry {
    return log("update", entity, entityId, actorProId, snapshot, metadata);
  },

  /**
   * Log a deletion event.
   * Snapshot should contain the FULL content of the deleted entity (non-repudiation).
   */
  logDelete(
    entity: AuditEntity,
    entityId: string,
    actorProId: string,
    snapshot: Record<string, unknown>,
  ): AuditEntry {
    return log("delete", entity, entityId, actorProId, snapshot);
  },

  // ─── Query API (admin/monitoring) ───

  /**
   * Get recent audit entries, optionally filtered.
   */
  getRecent(opts?: {
    limit?: number;
    entity?: AuditEntity;
    action?: AuditAction;
    actorProId?: string;
    entityId?: string;
  }): AuditEntry[] {
    const limit = opts?.limit || 50;
    let filtered = entries;

    if (opts?.entity) filtered = filtered.filter((e) => e.entity === opts.entity);
    if (opts?.action) filtered = filtered.filter((e) => e.action === opts.action);
    if (opts?.actorProId) filtered = filtered.filter((e) => e.actorProId === opts.actorProId);
    if (opts?.entityId) filtered = filtered.filter((e) => e.entityId === opts.entityId);

    return filtered.slice(-limit).reverse();
  },

  /**
   * Get the full history of a specific entity (all actions).
   */
  getEntityHistory(entity: AuditEntity, entityId: string): AuditEntry[] {
    return entries.filter((e) => e.entity === entity && e.entityId === entityId);
  },

  /**
   * Get all deletions by a specific user (useful for abuse detection).
   */
  getDeletionsByUser(actorProId: string, limit = 50): AuditEntry[] {
    return entries
      .filter((e) => e.action === "delete" && e.actorProId === actorProId)
      .slice(-limit)
      .reverse();
  },

  /**
   * Get stats for a user (useful for monitoring).
   */
  getUserStats(actorProId: string, sinceMs = 3600_000): { creates: number; updates: number; deletes: number } {
    const since = Date.now() - sinceMs;
    const userEntries = entries.filter(
      (e) => e.actorProId === actorProId && new Date(e.timestamp).getTime() > since,
    );
    return {
      creates: userEntries.filter((e) => e.action === "create").length,
      updates: userEntries.filter((e) => e.action === "update").length,
      deletes: userEntries.filter((e) => e.action === "delete").length,
    };
  },
};
