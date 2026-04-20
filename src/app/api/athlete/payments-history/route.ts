import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/athlete/payments-history
 *
 * Returns ALL payments for the authenticated athlete — used by the Documents page.
 * The frontend filters by tab (receipts, consultations, payments, refunds).
 */
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const payments = await prisma.payment.findMany({
      where: { athleteUserId: session.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        prestationType: true,
        paidAt: true,
        refundedAt: true,
        refundAmount: true,
        receiptNumber: true,
        receiptGeneratedAt: true,
        createdAt: true,
        professionnel: {
          select: {
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
        calendarEvent: {
          select: {
            id: true,
            date: true,
            endDate: true,
            title: true,
            type: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error("GET /api/athlete/payments-history:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
