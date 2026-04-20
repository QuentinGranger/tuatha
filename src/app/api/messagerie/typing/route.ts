import { NextRequest, NextResponse } from "next/server";
import { getSessionPro } from "@/lib/session";
import { setTyping, clearTyping, getTypingFor } from "@/lib/typingStore";

export const dynamic = "force-dynamic";

// POST /api/messagerie/typing — signal typing status
// Body: { receiverProId: string, typing?: boolean }
export async function POST(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { receiverProId, typing = true } = body;
    if (!receiverProId) {
      return NextResponse.json({ error: "receiverProId requis" }, { status: 400 });
    }

    if (typing) {
      setTyping(session.id, receiverProId);
    } else {
      clearTyping(session.id, receiverProId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/messagerie/typing?proId=xxx — check who is typing to me in a conversation
export async function GET(req: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const proId = req.nextUrl.searchParams.get("proId");
  // Get who is typing to the current user
  const typingProIds = getTypingFor(session.id);

  // If proId specified, filter to only that conversation partner
  if (proId) {
    return NextResponse.json({ typing: typingProIds.includes(proId) });
  }

  return NextResponse.json({ typingProIds });
}
