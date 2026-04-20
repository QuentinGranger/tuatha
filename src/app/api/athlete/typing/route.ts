import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { setTyping, clearTyping, getTypingFor } from "@/lib/typingStore";

export const dynamic = "force-dynamic";

// POST /api/athlete/typing — athlete signals typing status
// Body: { proId: string, typing?: boolean }
export async function POST(req: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { proId, typing = true } = body;
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    if (typing) {
      setTyping(session.id, proId);
    } else {
      clearTyping(session.id, proId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/athlete/typing?proId=xxx — check if a pro is typing to the athlete
export async function GET(req: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const proId = req.nextUrl.searchParams.get("proId");
  const typingIds = getTypingFor(session.id);

  if (proId) {
    return NextResponse.json({ typing: typingIds.includes(proId) });
  }

  return NextResponse.json({ typingIds });
}
