import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe, getMccForSpecialite, getBusinessType } from "@/lib/stripe";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * POST — Create or retrieve a Stripe Connect Express account for a professional,
 * then generate an Account Link (hosted onboarding) and return the URL.
 *
 * Body: { professionnelId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { professionnelId } = await request.json();

    if (!professionnelId) {
      return NextResponse.json(
        { error: "Identifiant professionnel manquant." },
        { status: 400 }
      );
    }

    const pro = await prisma.professionnel.findUnique({
      where: { id: professionnelId },
    });

    if (!pro) {
      return NextResponse.json(
        { error: "Professionnel introuvable." },
        { status: 404 }
      );
    }

    let stripeAccountId = pro.stripeAccountId;

    // ── Create Stripe Connect Express account if not yet created ──
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: pro.email,
        business_type: getBusinessType(pro.statutExercice),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          mcc: getMccForSpecialite(pro.specialite),
          name: `${pro.prenom} ${pro.nom}`,
          product_description: `Prestations de santé / sport via Tuatha`,
          url: `${BASE_URL}`,
        },
        individual: {
          first_name: pro.prenom,
          last_name: pro.nom,
          email: pro.email,
          phone: pro.telephone,
        },
        metadata: {
          tuatha_professionnel_id: pro.id,
          specialite: pro.specialite,
          statut_exercice: pro.statutExercice,
        },
      });

      stripeAccountId = account.id;

      await prisma.professionnel.update({
        where: { id: pro.id },
        data: { stripeAccountId },
      });
    }

    // ── Generate Account Link (hosted onboarding) ──
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${BASE_URL}/api/inscription/professionnel/stripe-onboarding/refresh?id=${pro.id}&specialite=${pro.specialite}&email=${encodeURIComponent(pro.email)}`,
      return_url: `${BASE_URL}/api/inscription/professionnel/stripe-onboarding/return?id=${pro.id}&specialite=${pro.specialite}&email=${encodeURIComponent(pro.email)}`,
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return NextResponse.json({
      url: accountLink.url,
      stripeAccountId,
    });
  } catch (error) {
    console.error("stripe-onboarding error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte de paiement." },
      { status: 500 }
    );
  }
}
