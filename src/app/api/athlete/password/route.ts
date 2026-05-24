import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { getSessionAthlete } from "@/lib/session";
import { revokeAllSessions } from "@/lib/session";
import { validatePassword } from "@/lib/security";
import { sendPasswordChangedAlert } from "@/lib/email";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PUT /api/athlete/password — change password (authenticated)
export async function PUT(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Mot de passe actuel et nouveau requis." }, { status: 400 });
    }

    // Enforce strong password policy
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      const missing = pwdCheck.checks.filter((c) => !c.met).map((c) => c.label).join(", ");
      return NextResponse.json({ error: `Mot de passe trop faible. Manque : ${missing}` }, { status: 400 });
    }

    const athlete = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { password: true, email: true, prenom: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, athlete.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.athleteUser.update({
      where: { id: session.id },
      data: { password: hashed },
    });

    // Revoke all other sessions (keep current one)
    await revokeAllSessions(session.id, session.sessionId, "athlete", "password_changed");

    // Send security alert email (non-blocking)
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    sendPasswordChangedAlert({
      to: athlete.email,
      prenom: athlete.prenom,
      ip,
      date: dateStr,
    }).catch((err) => {
      console.error("[Athlete Password] Failed to send changed alert:", err);
    });

    return NextResponse.json({ message: "Mot de passe modifié. Toutes les autres sessions ont été déconnectées." });
  } catch (error) {
    console.error("PUT /api/athlete/password:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
