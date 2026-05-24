import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { clearAuthCookies } from "@/lib/session";
import bcrypt from "bcrypt";

/**
 * DELETE /api/profil/account
 * Permanently deletes the authenticated user's account.
 * Requires password confirmation for security.
 */
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  try {
    const { password } = await req.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
    }

    const proId = ctx.session.id;

    // Verify the user exists and check password
    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { id: true, password: true, email: true, prenom: true },
    });

    if (!pro) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, pro.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Log security alert BEFORE cascade delete (so it persists in structured logs)
    console.warn(
      `[SECURITY-AUDIT] ACCOUNT_DELETED user=${proId} email=${pro.email} ip=${ip} ua=${userAgent}`,
    );

    // Create the alert before deletion (will be cascade-deleted, but structured log persists)
    await prisma.securityAlert.create({
      data: {
        type: "account_deleted",
        message: `Compte supprimé volontairement par l'utilisateur (${pro.email}).`,
        ip,
        userAgent,
        professionnelId: proId,
      },
    });

    // Revoke all sessions before deletion
    await prisma.authSession.updateMany({
      where: { professionnelId: proId, revoked: false },
      data: { revoked: true, revokedAt: new Date(), revokedReason: "account_deleted" },
    });

    // Delete the account — cascades to all related records
    await prisma.professionnel.delete({ where: { id: proId } });

    // Confirmation email (non-blocking)
    try {
      const { sendAccountDeletedEmail } = await import("@/lib/email");
      await sendAccountDeletedEmail({ to: pro.email, prenom: pro.prenom });
    } catch (emailErr) {
      console.error("[ACCOUNT-DELETE] Failed to send confirmation email:", emailErr);
    }

    const response = NextResponse.json({ message: "Compte supprimé avec succès." });
    clearAuthCookies(response);
    return response;
  } catch (err) {
    console.error("[ACCOUNT-DELETE] Error:", err);
    return NextResponse.json({ error: "Erreur lors de la suppression du compte." }, { status: 500 });
  }
});
