import { NextRequest, NextResponse } from "next/server";
import { getSessionPro } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/pro/booking-reminders
// Returns active in-app reminders for the logged-in professional.

export async function GET() {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const reminders = await prisma.bookingReminder.findMany({
      where: {
        professionnelId: session.id,
        recipientType: "pro",
        channel: "inapp",
        dismissed: false,
        scheduledAt: { lte: now },
        eventDate: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
        OR: [
          { sentAt: null },
          { sentAt: { gte: cutoff } },
        ],
      },
      include: {
        athleteUser: {
          select: { prenom: true, nom: true, email: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    });

    // Mark unsent as sent
    const unsentIds = reminders.filter((r: any) => !r.sentAt).map((r: any) => r.id);
    if (unsentIds.length > 0) {
      await prisma.bookingReminder.updateMany({
        where: { id: { in: unsentIds } },
        data: { sentAt: now },
      });
    }

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error("GET /api/pro/booking-reminders error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/pro/booking-reminders
// Dismiss a reminder by id.

export async function PATCH(request: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { reminderId } = await request.json();
    if (!reminderId) {
      return NextResponse.json({ error: "reminderId manquant" }, { status: 400 });
    }

    await prisma.bookingReminder.updateMany({
      where: { id: reminderId, professionnelId: session.id, recipientType: "pro" },
      data: { dismissed: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/pro/booking-reminders error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
