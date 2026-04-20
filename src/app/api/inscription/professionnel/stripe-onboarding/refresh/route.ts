import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * GET — Stripe redirects here when the Account Link expires or needs refresh.
 * We generate a new Account Link and redirect the professional back to Stripe.
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

    // ── Generate a fresh Account Link ──
    const accountLink = await stripe.accountLinks.create({
      account: pro.stripeAccountId,
      refresh_url: `${BASE_URL}/api/inscription/professionnel/stripe-onboarding/refresh?id=${pro.id}&specialite=${specialite}&email=${encodeURIComponent(email)}`,
      return_url: `${BASE_URL}/api/inscription/professionnel/stripe-onboarding/return?id=${pro.id}&specialite=${specialite}&email=${encodeURIComponent(email)}`,
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("stripe-onboarding refresh error:", error);
    return NextResponse.redirect(
      `${BASE_URL}/inscription/professionnel`
    );
  }
}
