// ─── MFA step-up verification for sensitive actions ───
//
// POST /api/athlete/verify-mfa
//
// Verifies MFA (TOTP, recovery code, or password fallback) before
// sensitive actions like export, account deletion, or email change.
//
// Returns a short-lived mfaToken (15 min) that must be passed to
// the sensitive action endpoint as proof of MFA verification.
//
// CNIL 2025: MFA progressive pour actions sensibles.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { verifyMfaStepUp } from "@/lib/mfa";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// In-memory store for MFA tokens (short-lived, 15 min)
// In production, use Redis or session store.
const mfaTokens = new Map<string, { userId: string; action: string; expiresAt: number }>();

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of mfaTokens) {
    if (val.expiresAt < now) mfaTokens.delete(key);
  }
}, 60_000);

export function verifyMfaToken(token: string, userId: string, action: string): boolean {
  const entry = mfaTokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    mfaTokens.delete(token);
    return false;
  }
  if (entry.userId !== userId || entry.action !== action) return false;
  // Single-use: consume after verification
  mfaTokens.delete(token);
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, totpCode, recoveryCode, password } = body;

    if (!action || !["export_data", "delete_account", "change_email"].includes(action)) {
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    }

    const user = await (prisma as any).athleteUser.findUnique({
      where: { id: session.id },
      select: {
        twoFactorEnabled: true,
        totpSecret: true,
        recoveryCodes: true,
        password: true,
      },
    });

    if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

    const result = await verifyMfaStepUp(
      { totpCode, recoveryCode, password },
      user,
    );

    if (!result.verified) {
      return NextResponse.json({
        error: result.error,
        mfaRequired: user.twoFactorEnabled,
      }, { status: 403 });
    }

    // Consume recovery code if used
    if (result.method === "recovery" && result.recoveryCodeIndex !== undefined) {
      const updatedCodes = [...(user.recoveryCodes || [])];
      updatedCodes.splice(result.recoveryCodeIndex, 1);
      await (prisma as any).athleteUser.update({
        where: { id: session.id },
        data: { recoveryCodes: updatedCodes },
      });
    }

    // Generate short-lived MFA token
    const mfaToken = crypto.randomBytes(32).toString("hex");
    mfaTokens.set(mfaToken, {
      userId: session.id,
      action,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return NextResponse.json({
      mfaToken,
      method: result.method,
      expiresIn: 900, // 15 min in seconds
    });
  } catch (err) {
    console.error("[verify-mfa] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
