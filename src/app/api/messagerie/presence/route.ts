import { NextRequest, NextResponse } from "next/server";
import { getSessionPro } from "@/lib/session";
import { heartbeat, getPresence } from "@/lib/presenceStore";

export const dynamic = "force-dynamic";

// POST /api/messagerie/presence — send heartbeat (I'm online)
export async function POST(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  heartbeat(session.id);
  return NextResponse.json({ ok: true });
}

// GET /api/messagerie/presence?proId=xxx — check if a pro is online / last seen
export async function GET(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Also heartbeat on GET (the caller is active)
  heartbeat(session.id);

  const proId = req.nextUrl.searchParams.get("proId");
  if (!proId) {
    return NextResponse.json({ error: "proId requis" }, { status: 400 });
  }

  const presence = getPresence(proId);
  return NextResponse.json(presence);
}
