import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

const VALID_DATA_KEYS = [
  "shareSport", "sharePhysical", "shareAntecedents",
  "shareTraitements", "shareContraindic", "shareVitals",
  "shareConsultPrep", "sharePhoto", "shareMessaging",
];

// POST /api/pro/data-access-request — pro requests access to a specific data type
export const POST = withAuth(async (request: NextRequest, ctx) => {
  try {
    const proId = ctx.session.id;
    const body = await request.json();
    const { athleteUserId, dataKey, reason } = body;

    if (!athleteUserId || !dataKey) {
      return NextResponse.json({ error: "athleteUserId et dataKey requis" }, { status: 400 });
    }
    if (!VALID_DATA_KEYS.includes(dataKey)) {
      return NextResponse.json({ error: "dataKey invalide" }, { status: 400 });
    }

    // Verify connection exists
    const conn = await prisma.connectionRequest.findFirst({
      where: { athleteUserId, professionnelId: proId, status: "accepted" },
    });
    if (!conn) {
      return NextResponse.json({ error: "Non connecté à cet athlète" }, { status: 403 });
    }

    // Check if there's already a pending request for this data key
    const existing = await (prisma as any).dataAccessRequest.findFirst({
      where: { athleteUserId, professionnelId: proId, dataKey, status: "pending" },
    });
    if (existing) {
      return NextResponse.json({ error: "Demande déjà en attente pour cette donnée" }, { status: 409 });
    }

    const req = await (prisma as any).dataAccessRequest.create({
      data: {
        athleteUserId,
        professionnelId: proId,
        dataKey,
        reason: reason?.trim()?.slice(0, 500) || null,
      },
    });

    return NextResponse.json({ ok: true, requestId: req.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pro/data-access-request error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
});
