import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { withAuth } from "@/lib/withAuth";
import { generateRecoveryCodes } from "@/lib/mfa";

// POST — Generate TOTP secret + QR code (setup, not yet enabled)
export const POST = withAuth(async (_req, ctx) => {
  try {
    const proId = ctx.session.id;

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { email: true, prenom: true, nom: true, twoFactorEnabled: true },
    });
    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    if (pro.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA déjà activé" }, { status: 400 });
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Tuatha",
      label: pro.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    // Store secret temporarily (not enabled yet until verified)
    await prisma.professionnel.update({
      where: { id: proId },
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
    console.error("POST /api/profil/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });

// PUT — Verify code and enable 2FA
export const PUT = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { totpSecret: true, twoFactorEnabled: true },
    });
    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (!pro.totpSecret) return NextResponse.json({ error: "Aucun secret configuré. Lancez d'abord le setup." }, { status: 400 });

    const totp = new OTPAuth.TOTP({
      issuer: "Tuatha",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(pro.totpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: "Code invalide" }, { status: 403 });
    }

    // Generate recovery codes on first activation
    const { plain, hashed } = await generateRecoveryCodes();

    await prisma.professionnel.update({
      where: { id: proId },
      data: { twoFactorEnabled: true, recoveryCodes: hashed },
    });

    console.log(`[SECURITY-AUDIT] PRO_2FA_ENABLED userId=${proId}`);

    return NextResponse.json({
      message: "2FA activé avec succès",
      recoveryCodes: plain,
      warning: "Conservez ces codes de secours en lieu sûr. Ils ne seront plus affichés.",
    });
  } catch (error) {
    console.error("PUT /api/profil/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });

// DELETE — Disable 2FA
export const DELETE = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Code requis pour désactiver" }, { status: 400 });

    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { totpSecret: true, twoFactorEnabled: true },
    });
    if (!pro || !pro.totpSecret || !pro.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA non activé" }, { status: 400 });
    }

    const totp = new OTPAuth.TOTP({
      issuer: "Tuatha",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(pro.totpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: "Code invalide" }, { status: 403 });
    }

    await prisma.professionnel.update({
      where: { id: proId },
      data: { twoFactorEnabled: false, totpSecret: null },
    });

    return NextResponse.json({ message: "2FA désactivé" });
  } catch (error) {
    console.error("DELETE /api/profil/2fa:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
