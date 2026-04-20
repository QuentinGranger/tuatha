import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// GET /api/athlete/contact/[proId] — fetch a connected pro's profile (for athlete)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { proId } = await params;

  try {
    // Verify athlete is connected to this pro
    const conn = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!conn) return NextResponse.json({ error: "Non connecté à ce professionnel" }, { status: 403 });

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        telephone: true,
        specialite: true,
        avatarPath: true,
        adresseCabinet: true,
        createdAt: true,
      },
    });

    if (!pro) return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });

    // Count shared messages
    const messageCount = await prisma.athleteProMessage.count({
      where: { athleteUserId: session.id, professionnelId: proId },
    });

    // Count shared media (attachments)
    const mediaCount = await prisma.athleteProMessageAttachment.count({
      where: {
        message: { athleteUserId: session.id, professionnelId: proId },
      },
    });

    return NextResponse.json({
      ...pro,
      avatarUrl: signAvatarUrl(pro.avatarPath),
      messageCount,
      mediaCount,
      connectedSince: conn.respondedAt ?? conn.createdAt,
    });
  } catch (error) {
    console.error("GET /api/athlete/contact/[proId] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
