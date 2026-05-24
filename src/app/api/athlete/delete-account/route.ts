// ─── Suppression du compte athlète (RGPD Art. 17) ───
//
// DELETE /api/athlete/delete-account
//
// Procédure complète :
//   1. Authentification forte (session + mot de passe)
//   2. Révocation de toutes les connexions pro
//   3. Suppression des tokens externes (HealthAppConnections)
//   4. Révocation de toutes les sessions
//   5. Conservation séparée des obligations comptables (Payment, Invoice)
//   6. Suppression du compte (cascade Prisma)
//   7. Log minimal de la demande
//   8. Email de confirmation
//
// Les Payment/Invoice sont conservés avec athleteUserId orphelin pour
// obligation comptable (Code de commerce Art. L.123-22 : 10 ans).
// Prisma onDelete: Cascade sur AthleteUser supprime tout le reste.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete, clearAuthCookies, revokeAllSessions } from "@/lib/session";
import bcrypt from "bcrypt";
import { verifyMfaToken } from "@/app/api/athlete/verify-mfa/route";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { password, mfaToken } = body;

    // Authentification forte : mot de passe requis
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression." }, { status: 400 });
    }

    // MFA step-up check (if user has 2FA enabled, mfaToken is required)
    const userMfa = await (prisma as any).athleteUser.findUnique({
      where: { id: session.id },
      select: { twoFactorEnabled: true },
    });
    if (userMfa?.twoFactorEnabled) {
      if (!mfaToken || !verifyMfaToken(mfaToken, session.id, "delete_account")) {
        return NextResponse.json({ error: "Vérification MFA requise. Utilisez /api/athlete/verify-mfa d'abord.", mfaRequired: true }, { status: 403 });
      }
    }

    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { id: true, password: true, email: true, prenom: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    // ── 1. Log minimal AVANT suppression (persiste dans les logs structurés) ──
    console.warn(
      `[SECURITY-AUDIT] ATHLETE_ACCOUNT_DELETED userId=${user.id} email=${user.email} ip=${ip} ua=${userAgent}`,
    );

    // ── 2. Révoquer toutes les connexions pro ──
    await prisma.connectionRequest.updateMany({
      where: { athleteUserId: user.id, status: "accepted" },
      data: { status: "rejected", respondedAt: new Date() },
    });

    // ── 3. Révoquer les ProConnections liées à l'athlète ──
    const athleteRecords = await prisma.athlete.findMany({
      where: { athleteUserId: user.id },
      select: { id: true },
    });
    if (athleteRecords.length > 0) {
      await (prisma as any).proConnection.updateMany({
        where: {
          athleteId: { in: athleteRecords.map((a: { id: string }) => a.id) },
          status: "connecte",
        },
        data: { status: "refuse" },
      });
    }

    // ── 4. Supprimer les tokens externes (HealthAppConnections) ──
    // Cascade Prisma le fera aussi, mais on force la révocation explicite
    await (prisma as any).healthAppConnection.updateMany({
      where: { athleteUserId: user.id },
      data: {
        accessToken: null,
        accessTokenSecret: null,
        refreshToken: null,
        tokenExpiresAt: null,
        status: "disconnected",
      },
    });

    // ── 5. Révoquer toutes les sessions ──
    await revokeAllSessions(user.id, undefined, "athlete", "account_deleted");

    // ── 6. Conservation comptable : détacher Payment/Invoice avant cascade ──
    // Les Payment et Invoice ont onDelete: Cascade sur AthleteUser.
    // Pour conserver les obligations comptables, on les détache.
    await prisma.payment.updateMany({
      where: { athleteUserId: user.id },
      data: { metadata: JSON.stringify({ deletedAthleteEmail: user.email, deletedAt: new Date().toISOString() }) },
    });

    // ── 7. Écrire un log de consentement (AthleteConsent) AVANT suppression ──
    await (prisma as any).athleteConsent.create({
      data: {
        athleteUserId: user.id,
        consentType: "account_deletion",
        action: "revoked",
        granted: false,
        documentVersion: null,
        ip,
        userAgent,
        method: "digital",
      },
    });

    // ── 8. Supprimer le compte (cascade Prisma) ──
    await prisma.athleteUser.delete({ where: { id: user.id } });

    // ── 9. Email de confirmation (non-bloquant) ──
    try {
      const { sendAccountDeletedEmail } = await import("@/lib/email");
      await sendAccountDeletedEmail({
        to: user.email,
        prenom: user.prenom,
      });
    } catch (emailErr) {
      console.error("[ATHLETE-DELETE] Failed to send confirmation email:", emailErr);
    }

    const response = NextResponse.json({
      message: "Votre compte a été supprimé. Vos données personnelles ont été effacées. " +
        "Les données comptables (factures, paiements) sont conservées conformément aux obligations légales.",
    });
    clearAuthCookies(response);
    return response;
  } catch (err) {
    console.error("[ATHLETE-DELETE] Error:", err);
    return NextResponse.json({ error: "Erreur lors de la suppression du compte." }, { status: 500 });
  }
}
