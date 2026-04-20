import { prisma } from "@/lib/prisma";

// ─── Admin Log: Persistent cabinet activity logs ───
// Tracks who modified rights, added/removed members, etc.
// Stored in PostgreSQL for durability and queryability.

export type AdminAction =
  | "cabinet_created"
  | "member_added"
  | "member_removed"
  | "role_changed"
  | "cabinet_updated"
  | "cabinet_deleted"
  | "offboarding"
  | "transfer_blocked";

interface AdminLogParams {
  cabinetId: string;
  actorProId: string;
  action: AdminAction;
  targetProId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAdminLog(params: AdminLogParams): Promise<void> {
  try {
    await (prisma as any).adminLog.create({
      data: {
        cabinetId: params.cabinetId,
        actorProId: params.actorProId,
        action: params.action,
        targetProId: params.targetProId || null,
        details: params.details || {},
        ip: params.ip || null,
      },
    });
  } catch (err) {
    // Log write should never block the main operation
    console.error("[ADMIN_LOG] Failed to write admin log:", err);
  }
}
