import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete, getSessionPro } from "@/lib/session";
import { publishVisioSignal, verifyVisioRoomAccess, type VisioSignalType } from "@/lib/visioSignalStore";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: ReadonlySet<VisioSignalType> = new Set([
  "join",
  "offer",
  "answer",
  "ice-candidate",
  "leave",
]);

async function resolveParticipantId() {
  const proSession = await getSessionPro();
  if (proSession) return `pro:${proSession.id}`;
  const athleteSession = await getSessionAthlete();
  if (athleteSession) return `athlete:${athleteSession.id}`;
  return null;
}

export async function POST(request: NextRequest) {
  const participantId = await resolveParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const roomId = typeof b.roomId === "string" ? b.roomId.trim() : "";
  const senderId = typeof b.senderId === "string" ? b.senderId.trim() : "";
  const type = b.type as VisioSignalType;
  const targetId = typeof b.targetId === "string" ? b.targetId.trim() : null;

  if (!roomId || roomId.length > 128) {
    return NextResponse.json({ error: "roomId invalide" }, { status: 400 });
  }
  if (senderId !== participantId) {
    return NextResponse.json({ error: "senderId invalide" }, { status: 403 });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  }

  // Verify participant belongs to this room's CalendarEvent
  const hasAccess = await verifyVisioRoomAccess(roomId, participantId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès refusé à cette room" }, { status: 403 });
  }

  await publishVisioSignal({
    roomId,
    senderId,
    targetId,
    type,
    payload: b.payload ?? null,
    at: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
