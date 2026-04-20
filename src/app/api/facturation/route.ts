import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createInvoiceSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/facturation — list all invoices for the current pro
export const GET = withAuth(async (_request, ctx) => {
  try {
    const pro = ctx.session;

    const invoices = await (prisma as any).invoice.findMany({
      where: { professionnelId: pro.id, deletedAt: null },
      include: {
        athlete: { select: { id: true, name: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true } },
        payment: { select: { id: true, stripePaymentIntentId: true, receiptNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("GET /api/facturation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });

// POST /api/facturation — create a new invoice
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createInvoiceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { description, amount, dueDate, athleteId, notes, prestationType } = parsed.data;

    // Auto-generate invoice number: FAC-YYYY-NNN
    const year = new Date().getFullYear();
    const count = await (prisma as any).invoice.count({
      where: { professionnelId: pro.id },
    });
    const number = `FAC-${year}-${String(count + 1).padStart(3, "0")}`;

    const invoice = await (prisma as any).invoice.create({
      data: {
        number,
        description,
        amount,
        dueDate: new Date(dueDate),
        notes: notes || null,
        prestationType: prestationType || null,
        source: "manual",
        athleteId: athleteId || null,
        professionnelId: pro.id,
      },
      include: {
        athlete: { select: { id: true, name: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true } },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("POST /api/facturation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });
