import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/auth";
import { getDefaultExpiresAt, DEFAULT_SHARED_SCOPES } from "@/lib/abac";
import { checkSharingConsent } from "@/lib/consentCheck";

// ─── Helpers ───

/** Timing-safe token comparison to prevent timing attacks */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Check if invitation has expired */
function isExpired(invite: { expiresAt: Date | null }): boolean {
  if (!invite.expiresAt) return false;
  return new Date() > new Date(invite.expiresAt);
}

// GET /api/invitation/[id]?token=xxx — fetch invite details (public, no auth required)
// Requires valid token in query string. Marks invitation as "used" on first access.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tokenParam = request.nextUrl.searchParams.get("token");

    const invite = await (prisma as any).proInvitation.findUnique({
      where: { id },
      include: {
        senderPro: { select: { nom: true, prenom: true, specialite: true } },
        athlete: { select: { name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }

    // ─── Token verification (single-use link security) ───
    if (!tokenParam || !tokensMatch(tokenParam, invite.token)) {
      console.warn(`[INVITE] Invalid token for invite ${id}`);
      return NextResponse.json({ error: "Lien d'invitation invalide ou expiré" }, { status: 403 });
    }

    // ─── Expiration check ───
    if (isExpired(invite)) {
      // Auto-cancel expired invitations
      if (invite.status === "envoyee") {
        await (prisma as any).proInvitation.update({
          where: { id },
          data: { status: "annulee" },
        });
      }
      return NextResponse.json({
        error: "Cette invitation a expiré",
        expired: true,
        expiresAt: invite.expiresAt,
      }, { status: 410 });
    }

    // ─── Mark as used on first access (single-use tracking) ───
    if (!invite.usedAt) {
      await (prisma as any).proInvitation.update({
        where: { id },
        data: { usedAt: new Date() },
      });
    }

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      message: invite.message,
      status: invite.status,
      senderName: `${invite.senderPro.prenom} ${invite.senderPro.nom}`,
      senderSpecialite: invite.senderPro.specialite,
      athleteName: invite.athlete.name,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error("GET /api/invitation/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/invitation/[id] — accept or decline
// Requires valid token in body. Re-checks expiration + single-use.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { accept, token: tokenParam } = await request.json();

    const invite = await (prisma as any).proInvitation.findUnique({
      where: { id },
      include: {
        senderPro: { select: { id: true } },
        athlete: { select: { id: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }

    // ─── Token verification ───
    if (!tokenParam || !tokensMatch(tokenParam, invite.token)) {
      console.warn(`[INVITE] Invalid token on POST for invite ${id}`);
      return NextResponse.json({ error: "Lien d'invitation invalide" }, { status: 403 });
    }

    // ─── Expiration check ───
    if (isExpired(invite)) {
      if (invite.status === "envoyee") {
        await (prisma as any).proInvitation.update({
          where: { id },
          data: { status: "annulee" },
        });
      }
      return NextResponse.json({ error: "Cette invitation a expiré", expired: true }, { status: 410 });
    }

    if (invite.status !== "envoyee") {
      return NextResponse.json({ error: "Cette invitation a déjà été traitée" }, { status: 400 });
    }

    // Check if the responding user is logged in
    const session = await getSessionPro();

    if (!session) {
      // Not logged in — redirect to signup/login with invite context
      const redirectUrl = `/inscription/professionnel?invite=${id}&email=${encodeURIComponent(invite.email)}`;
      return NextResponse.json({ error: "Non authentifié", redirect: redirectUrl }, { status: 401 });
    }

    // Update invite status + mark used
    const newStatus = accept ? "acceptee" : "refusee";
    await (prisma as any).proInvitation.update({
      where: { id },
      data: {
        status: newStatus,
        usedAt: invite.usedAt || new Date(),
      },
    });

    // If accepted, create a ProConnection
    if (accept) {
      // Consent check: verify athlete still consents to sharing
      const consent = await checkSharingConsent(invite.athleteId);
      if (!consent.granted) {
        // Revert invite status — can't accept without consent
        await (prisma as any).proInvitation.update({ where: { id }, data: { status: "envoyee" } });
        return NextResponse.json({ error: consent.reason, consentRequired: true }, { status: 403 });
      }

      // Check if connection already exists
      const existing = await (prisma as any).proConnection.findFirst({
        where: {
          athleteId: invite.athleteId,
          ownerProId: invite.senderProId,
          connectedProId: session.id,
        },
      });

      if (!existing) {
        await (prisma as any).proConnection.create({
          data: {
            athleteId: invite.athleteId,
            ownerProId: invite.senderProId,
            connectedProId: session.id,
            role: invite.role,
            status: "connecte",
            dataScopes: DEFAULT_SHARED_SCOPES,
            expiresAt: getDefaultExpiresAt(),
          },
        });
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    console.error("POST /api/invitation/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
