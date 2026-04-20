// ─── Soft-Delete & Purge System ───
//
// Protects against malicious or accidental data deletion by intercepting
// hard deletes and converting them to soft-deletes (setting deletedAt).
//
// Features:
//   1. softDelete()  — mark record as deleted (set deletedAt + deletedBy)
//   2. restore()     — undo a soft-delete (clear deletedAt)
//   3. notDeleted    — Prisma where-clause filter for active records
//   4. purgeExpired() — permanently delete records past retention period
//   5. listDeleted() — list soft-deleted records for recovery UI
//
// Models with soft-delete support:
//   Athlete, SharedDocument, AthleteVideo, CalendarEvent, KanbanTask,
//   Session, CollabNote, ProMessage, Invoice, KinePlan, NutriPlan,
//   MedOrdonnance, MedProtocol, Cabinet
//
// Purge retention: 30 days (configurable)

import { prisma } from "@/lib/prisma";

// ─── Configuration ───

const CONFIG = {
  /** Days before soft-deleted records are permanently purged */
  retentionDays: 30,

  /** Models that support soft-delete */
  models: [
    "athlete",
    "sharedDocument",
    "athleteVideo",
    "calendarEvent",
    "kanbanTask",
    "session",
    "collabNote",
    "proMessage",
    "invoice",
    "kinePlan",
    "nutriPlan",
    "medOrdonnance",
    "medProtocol",
    "cabinet",
  ] as const,
};

export type SoftDeleteModel = (typeof CONFIG.models)[number];

// ─── Where-clause filter ───

/** Add this to any Prisma `where` to exclude soft-deleted records */
export const notDeleted = { deletedAt: null } as const;

// ─── Core operations ───

/**
 * Soft-delete a record: sets deletedAt + deletedBy instead of hard-deleting.
 *
 * @param model    - Prisma model name (e.g. "athlete", "sharedDocument")
 * @param id       - Record ID
 * @param actorId  - ID of the user performing the deletion (audit trail)
 * @returns The updated record, or null if not found
 */
export async function softDelete(
  model: SoftDeleteModel,
  id: string,
  actorId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model "${model}" not found on Prisma client.`);

    const record = await delegate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });

    console.log(
      `[SoftDelete] ${model}#${id} marked as deleted by ${actorId}`,
    );

    return record;
  } catch (error) {
    // Record not found or update failed
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) return null;
    throw error;
  }
}

/**
 * Restore a soft-deleted record (undo deletion).
 *
 * @param model    - Prisma model name
 * @param id       - Record ID
 * @param actorId  - ID of the user restoring the record
 * @returns The restored record, or null if not found
 */
export async function restore(
  model: SoftDeleteModel,
  id: string,
  actorId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model "${model}" not found on Prisma client.`);

    // Verify the record is actually soft-deleted
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return null;
    if (!existing.deletedAt) return existing; // Not deleted

    const record = await delegate.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });

    console.log(
      `[SoftDelete] ${model}#${id} restored by ${actorId}`,
    );

    return record;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) return null;
    throw error;
  }
}

/**
 * List soft-deleted records for a specific model, optionally filtered by owner.
 *
 * @param model  - Prisma model name
 * @param where  - Additional filter (e.g. { professionnelId: proId })
 * @param limit  - Max records to return (default 50)
 */
export async function listDeleted(
  model: SoftDeleteModel,
  where: Record<string, unknown> = {},
  limit = 50,
): Promise<{ id: string; deletedAt: Date; deletedBy: string | null; [key: string]: unknown }[]> {
  const delegate = (prisma as any)[model];
  if (!delegate) throw new Error(`Model "${model}" not found on Prisma client.`);

  return delegate.findMany({
    where: {
      ...where,
      deletedAt: { not: null },
    },
    orderBy: { deletedAt: "desc" },
    take: limit,
  });
}

// ─── Purge (permanent deletion after retention period) ───

interface PurgeResult {
  model: string;
  purged: number;
}

/**
 * Permanently delete records that have been soft-deleted for longer than
 * the retention period (default: 30 days).
 *
 * ⚠️ DESTRUCTIVE — records are permanently removed.
 *
 * @returns Summary of purged records per model
 */
export async function purgeExpired(): Promise<PurgeResult[]> {
  const cutoff = new Date(Date.now() - CONFIG.retentionDays * 24 * 60 * 60 * 1000);
  const results: PurgeResult[] = [];

  console.log(
    `[SoftDelete] Purging records deleted before ${cutoff.toISOString()} (${CONFIG.retentionDays} day retention)...`,
  );

  for (const model of CONFIG.models) {
    try {
      const delegate = (prisma as any)[model];
      if (!delegate) continue;

      const { count } = await delegate.deleteMany({
        where: {
          deletedAt: { not: null, lt: cutoff },
        },
      });

      results.push({ model, purged: count });

      if (count > 0) {
        console.log(`[SoftDelete] Purged ${count} ${model} record(s).`);
      }
    } catch (error) {
      console.error(`[SoftDelete] Purge error for ${model}:`, error);
      results.push({ model, purged: 0 });
    }
  }

  const total = results.reduce((sum, r) => sum + r.purged, 0);
  console.log(`[SoftDelete] Purge complete: ${total} record(s) permanently deleted.`);

  return results;
}

// ─── Status ───

/**
 * Get soft-delete system status: counts of soft-deleted records per model.
 */
export async function getDeletedCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const model of CONFIG.models) {
    try {
      const delegate = (prisma as any)[model];
      if (!delegate) continue;

      counts[model] = await delegate.count({
        where: { deletedAt: { not: null } },
      });
    } catch {
      counts[model] = 0;
    }
  }

  return counts;
}

/**
 * Get full soft-delete configuration.
 */
export function getConfig(): {
  retentionDays: number;
  models: readonly string[];
  purgeAfter: string;
} {
  return {
    retentionDays: CONFIG.retentionDays,
    models: CONFIG.models,
    purgeAfter: `${CONFIG.retentionDays} jours`,
  };
}
