import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/med-ordonnances?proId=xxx
// Returns signed/transmitted ordonnances for the authenticated athlete (read-only)
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-med-ordonnances:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    // Verify connection athlete ↔ pro
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Resolve athlete record for this pro
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const athlete = await (prisma as any).athlete.findFirst({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Fiche athlète introuvable" }, { status: 404 });
    }

    // Fetch ordonnances: only signed/transmitted, exclude drafts + soft-deleted
    const rawOrdonnances = await (prisma as any).medOrdonnance.findMany({
      where: {
        athleteId: athlete.id,
        proId,
        status: { in: ["signee", "transmise"] },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to athlete-safe fields (strip signatureData image to save bandwidth, keep proof)
    const ordonnances = rawOrdonnances.map((o: any) => {
      let signatureProof = null;
      if (o.signatureData) {
        try {
          const sig = JSON.parse(o.signatureData);
          signatureProof = {
            shortId: sig.shortId,
            hash: sig.hash,
            timestamp: sig.timestamp,
          };
        } catch { /* ignore */ }
      }

      let content = {};
      if (o.contentJson) {
        try { content = JSON.parse(o.contentJson); } catch { /* ignore */ }
      }

      return {
        id: o.id,
        type: o.type,
        status: o.status,
        diagnosis: o.diagnosis,
        content,
        episode: o.episode,
        validUntil: o.validUntil,
        signedAt: o.signedAt,
        version: o.version,
        pdfUrl: o.pdfUrl,
        signatureProof,
        createdAt: o.createdAt,
      };
    });

    return NextResponse.json({ ordonnances });
  } catch (error) {
    console.error("[athlete/med-ordonnances] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
