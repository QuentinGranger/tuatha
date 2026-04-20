import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/slot-alerts — list active alerts for this athlete
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const alerts = await prisma.slotAlert.findMany({
      where: { athleteUserId: session.id, active: true },
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("GET /api/athlete/slot-alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/slot-alerts — create a new slot alert with preferences
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.sensitive);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      professionnelId,
      preferredDays,
      timeStart,
      timeEnd,
      format,
      motif,
      priority,
    } = body;

    const alert = await prisma.slotAlert.create({
      data: {
        athleteUserId: session.id,
        professionnelId: professionnelId || null,
        preferredDays: preferredDays || [],
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        format: format || null,
        motif: motif || null,
        priority: priority || false,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, alert });
  } catch (error) {
    console.error("POST /api/athlete/slot-alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/athlete/slot-alerts — deactivate a slot alert
export async function DELETE(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { alertId } = await request.json();
    if (!alertId) {
      return NextResponse.json({ error: "alertId manquant" }, { status: 400 });
    }

    await prisma.slotAlert.updateMany({
      where: { id: alertId, athleteUserId: session.id },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/athlete/slot-alerts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
