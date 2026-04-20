import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { getReceiptData, generateReceiptHtml } from "@/lib/receipt";

/**
 * GET /api/payments/receipt/[id]
 *
 * Returns a print-ready HTML receipt for a given Payment ID.
 * Only accessible by the athlete who made the payment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership first
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { athleteUserId: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
    }

    if (payment.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const data = await getReceiptData(id);

    if (!data) {
      return NextResponse.json({ error: "Reçu introuvable ou paiement non confirmé" }, { status: 404 });
    }

    const html = generateReceiptHtml(data);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="recu-${data.receiptNumber}.html"`,
      },
    });
  } catch (error) {
    console.error("GET /api/payments/receipt/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du reçu" }, { status: 500 });
  }
}
