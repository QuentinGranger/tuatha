// PCI DSS / CNIL : Ce endpoint ne collecte et ne stocke AUCUNE donnée de carte.
// Le paiement est entièrement délégué à Stripe Checkout hébergé.
// Voir src/lib/pci.ts pour la politique complète.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getSessionAthlete } from "@/lib/session";
import { sanitizeBody } from "@/lib/sanitize";
import { isPaymentReady } from "@/lib/accountStatus";
import { stripCardData } from "@/lib/pci";
import { PAYMENT_STATUSES, isPaid, PENDING_STATUSES } from "@/lib/paymentStatus";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Platform fee: 5% of the total amount (configurable)
const PLATFORM_FEE_PCT = 5;

/**
 * POST /api/payments/create-checkout
 *
 * Creates a Stripe Checkout Session using Connect destination charges.
 * Flow: Athlete pays → Stripe collects → Tuatha takes commission → Pro gets paid.
 *
 * Body: { calendarEventId, tarifId? }
 *
 * Requirements:
 * - Athlete must be authenticated
 * - Pro must have accountStatus === "active" (payment-ready)
 * - Pro must have a Stripe Connect account with charges enabled
 */
export async function POST(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = stripCardData(sanitizeBody(await request.json())) as Record<string, unknown>;
    const { calendarEventId, tarifId } = body as { calendarEventId?: string; tarifId?: string };

    if (!calendarEventId) {
      return NextResponse.json({ error: "calendarEventId requis" }, { status: 400 });
    }

    // ── Fetch calendar event ──
    const event = await prisma.calendarEvent.findUnique({
      where: { id: calendarEventId },
      select: {
        id: true,
        title: true,
        date: true,
        endDate: true,
        athleteUserId: true,
        professionnelId: true,
        deletedAt: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
    }
    if (event.deletedAt) {
      return NextResponse.json({ error: "Ce rendez-vous est annulé" }, { status: 400 });
    }
    if (event.athleteUserId !== session.id) {
      return NextResponse.json({ error: "Ce rendez-vous ne vous appartient pas" }, { status: 403 });
    }

    // ── Fetch pro + verify payment-readiness ──
    const pro = await prisma.professionnel.findUnique({
      where: { id: event.professionnelId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        specialite: true,
        email: true,
        accountStatus: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    });

    if (!pro) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }
    if (!isPaymentReady(pro.accountStatus)) {
      return NextResponse.json(
        { error: "Ce professionnel n'est pas encore disponible pour les paiements. Son compte est en cours de vérification." },
        { status: 403 },
      );
    }
    if (!pro.stripeAccountId || !pro.stripeChargesEnabled) {
      return NextResponse.json(
        { error: "Le compte de paiement du professionnel n'est pas encore configuré." },
        { status: 403 },
      );
    }

    // ── Check for existing pending payment ──
    const existingPayment = await prisma.payment.findFirst({
      where: { calendarEventId, status: { in: [...PENDING_STATUSES, PAYMENT_STATUSES.paid, "pending"] } },
    });
    if (existingPayment) {
      if (isPaid(existingPayment.status)) {
        return NextResponse.json({ error: "Ce rendez-vous a déjà été payé" }, { status: 400 });
      }
      // Return existing checkout URL if still pending
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingPayment.stripeCheckoutSessionId);
        if (existingSession.status === "open" && existingSession.url) {
          return NextResponse.json({ checkoutUrl: existingSession.url });
        }
      } catch {
        // Session expired or invalid — clean up and create a new one
      }
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: PAYMENT_STATUSES.cancelled },
      });
    }

    // ── Determine amount ──
    let amount: number;
    let description: string;
    let prestationType: string | null = null;

    if (tarifId) {
      const tarif = await prisma.tarif.findUnique({
        where: { id: tarifId },
        select: { label: true, price: true, prestationType: true, professionnelId: true },
      });
      if (!tarif || tarif.professionnelId !== pro.id) {
        return NextResponse.json({ error: "Tarif introuvable ou non associé à ce professionnel" }, { status: 400 });
      }
      amount = tarif.price;
      description = tarif.label;
      prestationType = tarif.prestationType;
    } else {
      // Fallback: find cheapest active tarif for this pro
      const defaultTarif = await prisma.tarif.findFirst({
        where: { professionnelId: pro.id, active: true },
        orderBy: { price: "asc" },
        select: { label: true, price: true, prestationType: true },
      });
      if (!defaultTarif) {
        return NextResponse.json(
          { error: "Aucun tarif configuré pour ce professionnel. Impossible de procéder au paiement." },
          { status: 400 },
        );
      }
      amount = defaultTarif.price;
      description = defaultTarif.label;
      prestationType = defaultTarif.prestationType;
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
    }

    // ── Calculate platform fee ──
    const platformFee = Math.round((amount * PLATFORM_FEE_PCT) / 100);

    // ── Fetch athlete email ──
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true, prenom: true, nom: true },
    });

    // ── Create Stripe Checkout Session ──
    const dateStr = event.date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = event.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: athleteUser?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: amount,
            product_data: {
              name: `${description} — ${pro.prenom} ${pro.nom}`,
              description: `${dateStr} à ${timeStr}`,
              metadata: {
                calendarEventId: event.id,
                professionnelId: pro.id,
                prestationType: prestationType || "",
              },
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: pro.stripeAccountId,
        },
        metadata: {
          calendarEventId: event.id,
          athleteUserId: session.id,
          professionnelId: pro.id,
        },
      },
      metadata: {
        calendarEventId: event.id,
        athleteUserId: session.id,
        professionnelId: pro.id,
        tuatha_payment: "true",
      },
      success_url: `${BASE_URL}/dashboard/athlete/mes-rdv?payment=success&event=${event.id}`,
      cancel_url: `${BASE_URL}/dashboard/athlete/mes-rdv?payment=cancelled&event=${event.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
    });

    // ── Store payment record ──
    await prisma.payment.create({
      data: {
        stripeCheckoutSessionId: checkoutSession.id,
        athleteUserId: session.id,
        professionnelId: pro.id,
        calendarEventId: event.id,
        amount,
        platformFee,
        currency: "eur",
        status: PAYMENT_STATUSES.payment_pending,
        description,
        prestationType,
        metadata: JSON.stringify({
          eventTitle: event.title,
          eventDate: event.date.toISOString(),
          proName: `${pro.prenom} ${pro.nom}`,
          athleteName: athleteUser ? `${athleteUser.prenom} ${athleteUser.nom}` : null,
        }),
      },
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    console.error("POST /api/payments/create-checkout:", error);
    return NextResponse.json({ error: "Erreur lors de la création du paiement" }, { status: 500 });
  }
}
