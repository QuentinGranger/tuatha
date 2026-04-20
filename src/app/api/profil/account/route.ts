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
      select: { id: true, password: true, email: true },
    });

    if (!pro) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, pro.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }

    // Revoke all sessions before deletion
    await prisma.authSession.updateMany({
      where: { professionnelId: proId, revoked: false },
      data: { revoked: true, revokedAt: new Date(), revokedReason: "account_deleted" },
    });

    // Delete the account — cascades to all related records
    await prisma.professionnel.delete({ where: { id: proId } });

    console.log(`[ACCOUNT-DELETE] Account deleted: ${pro.email} (${proId})`);

    const response = NextResponse.json({ message: "Compte supprimé avec succès." });
    clearAuthCookies(response);
    return response;
  } catch (err) {
    console.error("[ACCOUNT-DELETE] Error:", err);
    return NextResponse.json({ error: "Erreur lors de la suppression du compte." }, { status: 500 });
  }
});
