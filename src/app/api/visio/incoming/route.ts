import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro, getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/visio/incoming
// Returns active incoming call (a "join" signal in a room belonging to this user,
// sent by someone else within the last 60 seconds, with no "leave" after it).

export async function GET() {
  let myRole: "pro" | "athlete" | null = null;
  let myId = "";
  let myName = "";

  const proSession = await getSessionPro();
  if (proSession?.id) {
    myRole = "pro";
    myId = proSession.id;
    const pro = await prisma.professionnel.findUnique({
      where: { id: proSession.id },
      select: { prenom: true, nom: true },
    });
    myName = pro ? `${pro.prenom} ${pro.nom}` : "";
  }
  if (!myRole) {
    const athleteSession = await getSessionAthlete();
    if (athleteSession?.id) {
      myRole = "athlete";
      myId = athleteSession.id;
      const ath = await prisma.athleteUser.findUnique({
        where: { id: athleteSession.id },
        select: { prenom: true, nom: true },
      });
      myName = ath ? `${ath.prenom} ${ath.nom}` : "";
    }
  }

  if (!myRole || !myId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const myParticipantId = `${myRole}:${myId}`;

    // Find rooms where this user is a participant (via CalendarEvent.visioRoomId)
    const whereClause: Record<string, unknown> = {
      visioRoomId: { not: null },
      deletedAt: null,
    };
    if (myRole === "pro") {
      whereClause.professionnelId = myId;
    } else {
      whereClause.athleteUserId = myId;
    }

    const events = await (prisma as any).calendarEvent.findMany({
      where: whereClause,
      select: {
        visioRoomId: true,
        title: true,
        date: true,
        ...(myRole === "pro"
          ? { athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } } }
          : { professionnel: { select: { id: true, prenom: true, nom: true, specialite: true, avatarPath: true } } }),
      },
    });

    if (events.length === 0) {
      return NextResponse.json({ incoming: null });
    }

    const roomMap = new Map<string, any>();
    for (const ev of events) {
      if (ev.visioRoomId) roomMap.set(ev.visioRoomId, ev);
    }

    // Find recent join signals in these rooms, NOT sent by me
    const joinSignals = await (prisma as any).visioSignal.findMany({
      where: {
        roomId: { in: Array.from(roomMap.keys()) },
        type: "join",
        createdAt: { gt: sixtySecondsAgo },
        NOT: { senderId: myParticipantId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (joinSignals.length === 0) {
      return NextResponse.json({ incoming: null });
    }

    // Check there's no "leave" signal after the join for the same sender+room
    for (const js of joinSignals) {
      const leaveAfter = await (prisma as any).visioSignal.findFirst({
        where: {
          roomId: js.roomId,
          senderId: js.senderId,
          type: "leave",
          createdAt: { gt: js.createdAt },
        },
      });
      if (leaveAfter) continue; // caller left, skip

      const ev = roomMap.get(js.roomId);
      const caller = myRole === "pro" ? ev?.athleteUser : ev?.professionnel;
      const callerName = caller ? `${caller.prenom} ${caller.nom}` : js.senderId;

      return NextResponse.json({
        incoming: {
          roomId: js.roomId,
          callerId: js.senderId,
          callerName,
          callerSpecialite: caller?.specialite || null,
          callerAvatar: caller?.avatarPath || null,
          eventTitle: ev?.title || null,
          eventDate: ev?.date || null,
          since: js.createdAt,
        },
      });
    }

    return NextResponse.json({ incoming: null });
  } catch (error) {
    console.error("GET /api/visio/incoming error:", error);
    return NextResponse.json({ incoming: null });
  }
}
