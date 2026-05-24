// ─── 2FA athlète ───
//
// POST   — Setup: generate TOTP secret + QR code + recovery codes
// PUT    — Verify: validate code and enable 2FA
// DELETE — Disable: validate code and disable 2FA
//
// CNIL 2025: MFA disponible pour l'athlète.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { createTOTP, verifyTOTP, generateRecoveryCodes } from "@/lib/mfa";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

// POST — Generate TOTP secret + QR code (setup, not yet enabled)
export async function POST() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (user.twoFactorEnabled) return NextResponse.json({ error: "2FA déjà activé" }, { status: 400 });

    const { totp, secret } = createTOTP(user.email);

    // Store secret temporarily (not enabled yet until verified)
    await prisma.athleteUser.update({
      where: { id: session.id },
      data: { totpSecret: secret.base32 },
    });

    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 256, margin: 2 });

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      uri,
    });
  } catch (error) {
    console.error("POST /api/athlete/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT — Verify code and enable 2FA + generate recovery codes
export async function PUT(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { totpSecret: true, twoFactorEnabled: true },
    });
    if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (!user.totpSecret) return NextResponse.json({ error: "Aucun secret configuré. Lancez d'abord le setup." }, { status: 400 });

    const valid = verifyTOTP(user.totpSecret, code);
    if (!valid) return NextResponse.json({ error: "Code invalide" }, { status: 403 });

    // Generate recovery codes
    const { plain, hashed } = await generateRecoveryCodes();

    await prisma.athleteUser.update({
      where: { id: session.id },
      data: { twoFactorEnabled: true, recoveryCodes: hashed },
    });

    console.log(`[SECURITY-AUDIT] ATHLETE_2FA_ENABLED userId=${session.id}`);

    return NextResponse.json({
      message: "2FA activé avec succès",
      recoveryCodes: plain,
      warning: "Conservez ces codes de secours en lieu sûr. Ils ne seront plus affichés.",
    });
  } catch (error) {
    console.error("PUT /api/athlete/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — Disable 2FA (requires valid TOTP code or recovery code)
export async function DELETE(request: NextRequest) {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Code requis pour désactiver" }, { status: 400 });

    const user = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { totpSecret: true, twoFactorEnabled: true },
    });
    if (!user || !user.totpSecret || !user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA non activé" }, { status: 400 });
    }

    const valid = verifyTOTP(user.totpSecret, code);
    if (!valid) return NextResponse.json({ error: "Code invalide" }, { status: 403 });

    await prisma.athleteUser.update({
      where: { id: session.id },
      data: { twoFactorEnabled: false, totpSecret: null, recoveryCodes: [] },
    });

    console.log(`[SECURITY-AUDIT] ATHLETE_2FA_DISABLED userId=${session.id}`);

    return NextResponse.json({ message: "2FA désactivé" });
  } catch (error) {
    console.error("DELETE /api/athlete/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
