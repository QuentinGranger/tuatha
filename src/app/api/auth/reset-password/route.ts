import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { validatePassword } from "@/lib/security";
import { sendPasswordChangedAlert } from "@/lib/email";
import { validateBody, resetPasswordSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const parsed = validateBody(await request.json(), resetPasswordSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { token, password } = parsed.data;

    // Validate password strength
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      const missing = pwdCheck.checks.filter((c) => !c.met).map((c) => c.label).join(", ");
      return NextResponse.json({ error: `Mot de passe trop faible. Manque : ${missing}` }, { status: 400 });
    }

    // Find token
    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } });

    if (!resetRecord) {
      return NextResponse.json({ error: "Lien de réinitialisation invalide." }, { status: 404 });
    }

    if (resetRecord.used) {
      return NextResponse.json({ error: "Ce lien a déjà été utilisé." }, { status: 410 });
    }

    if (new Date() > resetRecord.expiresAt) {
      return NextResponse.json({ error: "Ce lien a expiré. Veuillez en demander un nouveau." }, { status: 410 });
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password + mark token as used (transaction)
    await prisma.$transaction([
      prisma.professionnel.update({
        where: { id: resetRecord.professionnelId },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true, usedAt: new Date() },
      }),
      prisma.securityAlert.create({
        data: {
          type: "password_changed",
          message: "Mot de passe modifié via lien de réinitialisation.",
          ip,
          userAgent,
          professionnelId: resetRecord.professionnelId,
        },
      }),
    ]);

    // Send security alert email (non-blocking)
    const pro = await prisma.professionnel.findUnique({
      where: { id: resetRecord.professionnelId },
      select: { email: true, prenom: true },
    });

    if (pro) {
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
        console.error("[Reset] Failed to send password changed alert:", err);
      });
    }

    return NextResponse.json({ message: "Mot de passe modifié avec succès. Vous pouvez maintenant vous connecter." });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// GET — Validate token (check if it's still valid before showing the form)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token manquant." }, { status: 400 });
    }

    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } });

    if (!resetRecord) {
      return NextResponse.json({ valid: false, error: "Lien invalide." }, { status: 404 });
    }

    if (resetRecord.used) {
      return NextResponse.json({ valid: false, error: "Ce lien a déjà été utilisé." }, { status: 410 });
    }

    if (new Date() > resetRecord.expiresAt) {
      return NextResponse.json({ valid: false, error: "Ce lien a expiré." }, { status: 410 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("validate-reset-token error:", error);
    return NextResponse.json({ valid: false, error: "Erreur serveur." }, { status: 500 });
  }
}
