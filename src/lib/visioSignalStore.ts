import { prisma } from "@/lib/prisma";

export type VisioSignalType = "join" | "offer" | "answer" | "ice-candidate" | "leave";

export interface VisioSignalEvent {
  id: string;
  roomId: string;
  senderId: string;
  targetId?: string | null;
  type: VisioSignalType;
  payload?: unknown;
  at: number; // epoch ms
}

/**
 * Write a signal event to the DB so any server instance can read it.
 */
export async function publishVisioSignal(event: Omit<VisioSignalEvent, "id">) {
  await (prisma as any).visioSignal.create({
    data: {
      roomId: event.roomId,
      senderId: event.senderId,
      targetId: event.targetId || null,
      type: event.type,
      payload: event.payload != null ? JSON.stringify(event.payload) : null,
    },
  });
}

/**
 * Poll the DB for new signals in `roomId` created after `since`.
 * Returns the signals and the new cursor (latest createdAt).
 */
export async function pollVisioSignals(
  roomId: string,
  since: Date,
  excludeSender: string,
): Promise<{ signals: VisioSignalEvent[]; cursor: Date }> {
  const rows = await (prisma as any).visioSignal.findMany({
    where: {
      roomId,
      createdAt: { gt: since },
      NOT: { senderId: excludeSender },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const signals: VisioSignalEvent[] = rows.map((r: any) => ({
    id: r.id,
    roomId: r.roomId,
    senderId: r.senderId,
    targetId: r.targetId,
    type: r.type as VisioSignalType,
    payload: r.payload ? JSON.parse(r.payload) : null,
    at: r.createdAt.getTime(),
  }));

  const cursor = rows.length > 0 ? rows[rows.length - 1].createdAt : since;
  return { signals, cursor };
}

/**
 * Clean up old signals (> 5 min). Call periodically.
 */
export async function cleanupOldSignals() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  await (prisma as any).visioSignal.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

/**
 * Verify that a participant (e.g. "pro:abc" or "athlete:xyz") is allowed
 * to access a given visioRoomId by checking that a CalendarEvent exists
 * with that roomId and the participant is either the pro or the athlete.
 * Returns true if access is granted.
 */
export async function verifyVisioRoomAccess(
  roomId: string,
  participantId: string,
): Promise<boolean> {
  // participantId format: "pro:<id>" or "athlete:<id>"
  const [role, id] = participantId.split(":", 2);
  if (!role || !id) return false;

  const where: Record<string, unknown> = { visioRoomId: roomId, deletedAt: null };
  if (role === "pro") {
    where.professionnelId = id;
  } else if (role === "athlete") {
    where.athleteUserId = id;
  } else {
    return false;
  }

  const event = await (prisma as any).calendarEvent.findFirst({
    where,
    select: { id: true },
  });

  return !!event;
}
