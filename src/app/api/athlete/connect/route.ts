import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { sendConnectionRequestEmail } from "@/lib/mailer";

export async function POST(request: NextRequest) {
  // ── Rate limit ──
  const ip = getIP(request);
  const limited = applyRateLimit(`connect:${ip}`, { windowMs: 24 * 60 * 60 * 1000, maxAttempts: 20 });
  if (limited) return limited;

  // ── Auth ──
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Per-user rate limit (max 10 requests/day)
  const userLimited = applyRateLimit(`connect:user:${session.id}`, { windowMs: 24 * 60 * 60 * 1000, maxAttempts: 10 });
  if (userLimited) return userLimited;

  // ── Body ──
  let body: { professionnelId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { professionnelId } = body;
  if (!professionnelId || typeof professionnelId !== "string") {
    return NextResponse.json({ error: "professionnelId requis." }, { status: 400 });
  }

  try {
    // Verify the pro exists, is verified, and is searchable
    const pro = await prisma.professionnel.findUnique({
      where: { id: professionnelId },
      select: { id: true, nom: true, prenom: true, email: true, emailVerified: true, verificationStatus: true, searchable: true },
    });

    if (!pro || !pro.emailVerified || pro.verificationStatus !== "verified" || !pro.searchable) {
      return NextResponse.json({ error: "Professionnel introuvable." }, { status: 404 });
    }

    // Check if athlete is blocked by this pro
    const blocked = await prisma.blockedAthlete.findUnique({
      where: {
        professionnelId_athleteUserId: {
          professionnelId,
          athleteUserId: session.id,
        },
      },
    });
    if (blocked) {
      return NextResponse.json({ error: "Professionnel introuvable." }, { status: 404 });
    }

    // Check for existing request
    const existing = await prisma.connectionRequest.findUnique({
      where: {
        athleteUserId_professionnelId: {
          athleteUserId: session.id,
          professionnelId,
        },
      },
    });

    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json({ error: "Demande déjà envoyée.", status: existing.status }, { status: 409 });
      }
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "Vous êtes déjà connecté avec ce professionnel.", status: existing.status }, { status: 409 });
      }
      if (existing.status === "rejected") {
        // Allow re-sending after rejection: update to pending
        await prisma.connectionRequest.update({
          where: { id: existing.id },
          data: { status: "pending", respondedAt: null, createdAt: new Date() },
        });

        // Get athlete info for email
        const athlete = await prisma.athleteUser.findUnique({
          where: { id: session.id },
          select: { prenom: true, nom: true, email: true, sport: true },
        });

        // Send email (fire & forget)
        if (athlete) {
          sendConnectionRequestEmail({
            to: pro.email,
            proPrenom: pro.prenom,
            athletePrenom: athlete.prenom,
            athleteNom: athlete.nom,
            athleteSport: athlete.sport,
            requestId: existing.id,
          }).catch((err) => console.error("[connect] Email error:", err));
        }

        return NextResponse.json({ success: true, status: "pending", resent: true });
      }
    }

    // Get athlete info
    const athlete = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { prenom: true, nom: true, email: true, sport: true },
    });

    // Create new request
    const connectionRequest = await prisma.connectionRequest.create({
      data: {
        athleteUserId: session.id,
        professionnelId,
      },
    });

    // Send email notification to pro (fire & forget)
    if (athlete) {
      sendConnectionRequestEmail({
        to: pro.email,
        proPrenom: pro.prenom,
        athletePrenom: athlete.prenom,
        athleteNom: athlete.nom,
        athleteSport: athlete.sport,
        requestId: connectionRequest.id,
      }).catch((err) => console.error("[connect] Email error:", err));
    }

    return NextResponse.json({ success: true, status: "pending" });
  } catch (error) {
    console.error("[connect] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
