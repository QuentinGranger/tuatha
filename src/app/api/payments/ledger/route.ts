import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";
import { toLedgerEntry, computeLedgerSummary, ledgerToCsv } from "@/lib/ledger";

/**
 * GET /api/payments/ledger
 *
 * Returns the financial ledger for the authenticated professional.
 * Each payment includes: montant brut, commission Tuatha, frais PSP,
 * montant net pro, dates (paiement, remboursement, payout), statut final.
 *
 * Query params:
 *   from    — ISO date, filter payments created after this date
 *   to      — ISO date, filter payments created before this date
 *   status  — filter by payment status (comma-separated)
 *   format  — "json" (default) or "csv"
 *   limit   — max entries (default 200)
 *   offset  — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const statusFilter = searchParams.get("status");
  const format = searchParams.get("format") || "json";
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000);
  const offset = Number(searchParams.get("offset")) || 0;

  try {
    // Build where clause
    const where: any = {
      professionnelId: session.id,
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          athleteUser: { select: { prenom: true, nom: true } },
          calendarEvent: { select: { date: true, title: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const entries = payments.map(toLedgerEntry);

    // CSV export
    if (format === "csv") {
      const csv = ledgerToCsv(entries);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON response with summary
    const summary = computeLedgerSummary(entries);

    return NextResponse.json({
      entries,
      summary,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("Ledger API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
