import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { validateBody, updateInvoiceSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// PATCH /api/facturation/[id] — update an invoice (mark paid, edit, etc.)
export const PATCH = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    const parsed = validateBody(sanitizeBody(await request.json()), updateInvoiceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    // Verify ownership
    const existing = await (prisma as any).invoice.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined) data.notes = body.notes;

    // Mark as paid
    if (body.status === "paid") {
      data.status = "paid";
      data.paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
      if (body.paymentMethod) data.paymentMethod = body.paymentMethod;
    }
    // Mark as unpaid
    if (body.status === "unpaid") {
      data.status = "unpaid";
      data.paidDate = null;
      data.paymentMethod = null;
    }
    // Cancel
    if (body.status === "cancelled") {
      data.status = "cancelled";
    }

    const updated = await (prisma as any).invoice.update({
      where: { id },
      data,
      include: { athlete: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/facturation/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });

// DELETE /api/facturation/[id] — delete an invoice
export const DELETE = withAuth(async (_request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;

    const existing = await (prisma as any).invoice.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    await softDelete("invoice", id, pro.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/facturation/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });
