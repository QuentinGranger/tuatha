import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete, getSessionPro } from "@/lib/session";
import { pollVisioSignals, cleanupOldSignals, verifyVisioRoomAccess } from "@/lib/visioSignalStore";

export const dynamic = "force-dynamic";

const POLL_MS = 800;       // poll interval
const HEARTBEAT_MS = 20_000;
const MAX_DURATION_MS = 5 * 60 * 1000; // close SSE after 5 min to avoid stale connections

async function resolveParticipantId() {
  const proSession = await getSessionPro();
  if (proSession) return `pro:${proSession.id}`;
  const athleteSession = await getSessionAthlete();
  if (athleteSession) return `athlete:${athleteSession.id}`;
  return null;
}

export async function GET(req: NextRequest) {
  const participantId = await resolveParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roomId = req.nextUrl.searchParams.get("roomId")?.trim() || "";
  if (!roomId || roomId.length > 128) {
    return NextResponse.json({ error: "roomId invalide" }, { status: 400 });
  }

  // Verify participant belongs to this room's CalendarEvent
  const hasAccess = await verifyVisioRoomAccess(roomId, participantId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accès refusé à cette room" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      let alive = true;
      let cursor = new Date();

      const send = (chunk: string) => {
        if (!alive) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          alive = false;
        }
      };

      send(": connected\n\n");

      // DB polling loop
      const poll = setInterval(async () => {
        if (!alive) { clearInterval(poll); return; }
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          alive = false;
          clearInterval(poll);
          try { controller.close(); } catch {}
          return;
        }
        try {
          const { signals, cursor: newCursor } = await pollVisioSignals(roomId, cursor, participantId);
          cursor = newCursor;
          for (const sig of signals) {
            if (sig.targetId && sig.targetId !== participantId) continue;
            send(`data: ${JSON.stringify(sig)}\n\n`);
          }
        } catch {
          // Transient DB error — retry next tick
        }
      }, POLL_MS);

      // Heartbeat
      const hb = setInterval(() => {
        if (!alive) { clearInterval(hb); return; }
        send(": heartbeat\n\n");
      }, HEARTBEAT_MS);

      // Periodic cleanup of old signals (every 60s)
      const cleanup = setInterval(async () => {
        if (!alive) { clearInterval(cleanup); return; }
        try { await cleanupOldSignals(); } catch {}
      }, 60_000);

      req.signal.addEventListener("abort", () => {
        alive = false;
        clearInterval(poll);
        clearInterval(hb);
        clearInterval(cleanup);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
