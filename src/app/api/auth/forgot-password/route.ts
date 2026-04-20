import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rateLimit";
import { secrets } from "@/lib/vault";
import { validateBody, forgotPasswordSchema } from "@/lib/validation";

const RESET_EXPIRY_MINUTES = 15;
const MAX_RESETS_PER_HOUR = 3;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    // IP-level rate limit
    const ipLimit = checkRateLimit(`reset-ip:${ip}`, RATE_LIMITS.resetRequest);
    if (!ipLimit.allowed) {
      const res = NextResponse.json(
        { message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." }
      );
      res.headers.set("Retry-After", retryAfterSeconds(ipLimit.retryAfterMs));
      return res;
    }

    const parsed = validateBody(await request.json(), forgotPasswordSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { email } = parsed.data;
    const userAgent = request.headers.get("user-agent") || null;

    const pro = await prisma.professionnel.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!pro) {
      return NextResponse.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
    }

    // Anti-bruteforce: max N resets per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentResets = await prisma.passwordReset.count({
      where: {
        professionnelId: pro.id,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentResets >= MAX_RESETS_PER_HOUR) {
      // Log security alert
      await prisma.securityAlert.create({
        data: {
          type: "reset_rate_limited",
          message: `Tentative de reset bloquée : ${recentResets + 1} demandes en 1h (max ${MAX_RESETS_PER_HOUR}).`,
          ip,
          userAgent,
          professionnelId: pro.id,
        },
      });

      // Still return success to prevent enumeration
      return NextResponse.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
    }

    // Invalidate any existing unused tokens
    await prisma.passwordReset.updateMany({
      where: {
        professionnelId: pro.id,
        used: false,
        expiresAt: { gte: new Date() },
      },
      data: { used: true, usedAt: new Date() },
    });

    // Generate secure token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    // Save reset request
    await prisma.passwordReset.create({
      data: {
        token,
        expiresAt,
        ip,
        userAgent,
        professionnelId: pro.id,
      },
    });

    // Log security alert
    await prisma.securityAlert.create({
      data: {
        type: "password_reset_requested",
        message: `Demande de réinitialisation de mot de passe.`,
        ip,
        userAgent,
        professionnelId: pro.id,
      },
    });

    // Send email
    const baseUrl = secrets.appUrl();
    const resetUrl = `${baseUrl}/reinitialiser-mot-de-passe?token=${token}`;

    await sendPasswordResetEmail({
      to: pro.email,
      prenom: pro.prenom,
      resetUrl,
      expiresInMinutes: RESET_EXPIRY_MINUTES,
    });

    return NextResponse.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
