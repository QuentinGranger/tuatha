import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { computeAccountStatus } from "@/lib/accountStatus";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * GET — Stripe redirects here after the professional completes (or exits) onboarding.
 * We check the account status and redirect to the next onboarding step.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const professionnelId = searchParams.get("id");
    const specialite = searchParams.get("specialite") || "";
    const email = searchParams.get("email") || "";

    if (!professionnelId) {
      return NextResponse.redirect(`${BASE_URL}/inscription/professionnel`);
    }

    const pro = await prisma.professionnel.findUnique({
      where: { id: professionnelId },
    });

    if (!pro || !pro.stripeAccountId) {
      return NextResponse.redirect(`${BASE_URL}/inscription/professionnel`);
    }

    // ── Retrieve Stripe account to check status ──
    const account = await stripe.accounts.retrieve(pro.stripeAccountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    const updatedPro = await prisma.professionnel.update({
      where: { id: pro.id },
      data: {
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
        stripeDetailsSubmitted: detailsSubmitted,
        stripeOnboardingComplete: detailsSubmitted,
      },
    });

    // Recompute account status
    const newStatus = computeAccountStatus(updatedPro);
    if (newStatus !== updatedPro.accountStatus) {
      await prisma.professionnel.update({
        where: { id: pro.id },
        data: { accountStatus: newStatus },
      });
    }

    // ── Redirect to next step (configuration) ──
    if (detailsSubmitted) {
      return NextResponse.redirect(
        `${BASE_URL}/inscription/professionnel/configuration?id=${pro.id}&specialite=${specialite}&email=${encodeURIComponent(email)}`
      );
    }

    // If not complete, redirect back to the payment page with a warning
    return NextResponse.redirect(
      `${BASE_URL}/inscription/professionnel/paiement?id=${pro.id}&specialite=${specialite}&email=${encodeURIComponent(email)}&status=incomplete`
    );
  } catch (error) {
    console.error("stripe-onboarding return error:", error);
    return NextResponse.redirect(`${BASE_URL}/inscription/professionnel`);
  }
}
