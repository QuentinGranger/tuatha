// ─── Back-office remboursement ───
//
// POST /api/payments/refund
// Initie un remboursement total ou partiel via Stripe Refund API.
//
// Accessible par :
//   - Le professionnel propriétaire du paiement (withAuth)
//
// Body: { paymentId: string, amount?: number (cents, pour partiel), reason?: string }
//
// Le montant est optionnel : si absent, remboursement intégral.
// Le webhook charge.refunded met ensuite à jour le statut du Payment.
//
// CNIL / PCI : Aucune donnée de carte ne transite. Seuls des IDs Stripe sont utilisés.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { withAuth } from "@/lib/withAuth";
import { isPaid, isRefunded, PAYMENT_STATUSES } from "@/lib/paymentStatus";

export const POST = withAuth(async (request: NextRequest, ctx) => {
  try {
    const { paymentId, amount, reason } = await request.json();

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "paymentId requis" }, { status: 400 });
    }

    // Fetch the payment and verify ownership
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        professionnelId: true,
        stripePaymentIntentId: true,
        amount: true,
        refundAmount: true,
        status: true,
        description: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    // Only the owning professional can issue a refund
    if (payment.professionnelId !== ctx.session.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Payment must be in a paid/collected state
    if (!isPaid(payment.status)) {
      return NextResponse.json(
        { error: "Ce paiement n'est pas dans un état remboursable" },
        { status: 400 },
      );
    }

    if (isRefunded(payment.status) && payment.status === PAYMENT_STATUSES.refunded) {
      return NextResponse.json(
        { error: "Ce paiement a déjà été intégralement remboursé" },
        { status: 400 },
      );
    }

    if (!payment.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "Impossible de rembourser : identifiant Stripe manquant" },
        { status: 400 },
      );
    }

    // Determine refund amount
    const alreadyRefunded = payment.refundAmount || 0;
    const maxRefundable = payment.amount - alreadyRefunded;

    let refundAmountCents: number;
    if (amount !== undefined) {
      refundAmountCents = Math.round(Number(amount));
      if (isNaN(refundAmountCents) || refundAmountCents <= 0) {
        return NextResponse.json({ error: "Montant de remboursement invalide" }, { status: 400 });
      }
      if (refundAmountCents > maxRefundable) {
        return NextResponse.json(
          { error: `Montant trop élevé. Maximum remboursable : ${maxRefundable} centimes` },
          { status: 400 },
        );
      }
    } else {
      refundAmountCents = maxRefundable;
    }

    // Initiate Stripe refund
    const stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: refundAmountCents,
      reason: "requested_by_customer",
      metadata: {
        tuatha_payment_id: payment.id,
        initiated_by: ctx.session.id,
        reason: reason || "Remboursement demandé par le professionnel",
      },
    });

    // Audit log (finance-separated, no health data)
    console.log(
      `[FINANCE-AUDIT] REFUND_INITIATED by=${ctx.session.id} paymentId=${payment.id} ` +
      `amount=${refundAmountCents} stripeRefundId=${stripeRefund.id} reason=${reason || "none"}`,
    );

    // Note: the actual status update (refunded / refund_partial) will happen
    // via the charge.refunded webhook for consistency.

    return NextResponse.json({
      ok: true,
      refundId: stripeRefund.id,
      amount: refundAmountCents,
      status: stripeRefund.status,
      message: refundAmountCents === maxRefundable
        ? "Remboursement intégral initié"
        : `Remboursement partiel de ${refundAmountCents} centimes initié`,
    });
  } catch (error: any) {
    // Handle Stripe-specific errors
    if (error?.type === "StripeInvalidRequestError") {
      console.error("[Refund] Stripe error:", error.message);
      return NextResponse.json(
        { error: "Erreur Stripe lors du remboursement. Veuillez réessayer." },
        { status: 400 },
      );
    }
    console.error("POST /api/payments/refund:", error);
    return NextResponse.json({ error: "Erreur lors du remboursement" }, { status: 500 });
  }
}, { resource: "profil" });
