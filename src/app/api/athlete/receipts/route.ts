import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { ATHLETE_PAID_STATUSES } from "@/lib/paymentStatus";

/**
 * GET /api/athlete/receipts
 *
 * Returns all paid payments with receipts for the authenticated athlete.
 */
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const payments = await prisma.payment.findMany({
      where: {
        athleteUserId: session.id,
        status: { in: [...ATHLETE_PAID_STATUSES, "paid"] },
        receiptNumber: { not: null },
      },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        currency: true,
        description: true,
        prestationType: true,
        paidAt: true,
        receiptGeneratedAt: true,
        professionnel: {
          select: {
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
        calendarEvent: {
          select: {
            date: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({ receipts: payments });
  } catch (error) {
    console.error("GET /api/athlete/receipts:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des reçus" }, { status: 500 });
  }
}
