import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { withAuth } from "@/lib/withAuth";
import { validateBody, z } from "@/lib/validation";
import { validatePassword } from "@/lib/security";
import { revokeAllSessions } from "@/lib/session";
import { sendPasswordChangedAlert } from "@/lib/email";

export const PUT = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;
    const sessionId = ctx.session.sessionId;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    const schema = z.object({
      currentPassword: z.string().min(1, "Mot de passe actuel requis."),
      newPassword: z.string().min(8, "Le nouveau mot de passe doit faire au moins 8 caractères."),
    });
    const parsed = validateBody(await request.json(), schema);
    if (!parsed.success) return parsed.errorResponse;
    const { currentPassword, newPassword } = parsed.data;

    // Enforce strong password policy
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      const missing = pwdCheck.checks.filter((c) => !c.met).map((c) => c.label).join(", ");
      return NextResponse.json({ error: `Mot de passe trop faible. Manque : ${missing}` }, { status: 400 });
    }

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { password: true, email: true, prenom: true },
    });

    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, pro.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.professionnel.update({
        where: { id: proId },
        data: { password: hashed },
      }),
      prisma.securityAlert.create({
        data: {
          type: "password_changed",
          message: "Mot de passe modifié depuis les paramètres du profil.",
          ip,
          userAgent,
          professionnelId: proId,
        },
      }),
    ]);

    // Revoke all other sessions (keep current one)
    await revokeAllSessions(proId, sessionId, "pro", "password_changed");

    // Send security alert email (non-blocking)
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    sendPasswordChangedAlert({
      to: pro.email,
      prenom: pro.prenom,
      ip,
      date: dateStr,
    }).catch((err) => {
      console.error("[Password] Failed to send changed alert:", err);
    });

    return NextResponse.json({ message: "Mot de passe modifié. Toutes les autres sessions ont été déconnectées." });
  } catch (error) {
    console.error("PUT /api/profil/password:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
