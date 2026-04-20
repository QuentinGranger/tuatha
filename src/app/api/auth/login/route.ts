import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import * as OTPAuth from "otpauth";
import { createSession, setAuthCookies } from "@/lib/session";
import { sendNewDeviceAlert } from "@/lib/email";
import { validateBody, loginSchema } from "@/lib/validation";
import { checkRateLimit, checkLoginProtection, recordLoginFailure, recordLoginSuccess, retryAfterSeconds, RATE_LIMITS } from "@/lib/rateLimit";
import { assessLoginRisk } from "@/lib/riskDetection";
import { securityMonitor } from "@/lib/securityMonitor";
import { getDashboardPath } from "@/lib/specialites";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIP(request);
    const userAgent = request.headers.get("user-agent") || null;

    // ── IP-level rate limit ──
    const ipLimit = checkRateLimit(`login-ip:${ip}`, RATE_LIMITS.login);
    if (!ipLimit.allowed) {
      const res = NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard.", retryAfter: Math.ceil(ipLimit.retryAfterMs / 1000) },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(ipLimit.retryAfterMs));
      return res;
    }

    const parsed = validateBody(await request.json(), loginSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { email, password, totpCode } = parsed.data;

    const emailLower = email;

    // ── Account-level brute-force protection ──
    const loginCheck = checkLoginProtection(emailLower);
    if (!loginCheck.allowed) {
      const minutes = Math.ceil(loginCheck.retryAfterMs / 60000);
      const res = NextResponse.json(
        { error: `Compte temporairement verrouillé suite à trop de tentatives. Réessayez dans ${minutes} minute(s).`, locked: true, retryAfter: Math.ceil(loginCheck.retryAfterMs / 1000) },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(loginCheck.retryAfterMs));
      return res;
    }

    const pro = await prisma.professionnel.findUnique({ where: { email: emailLower } });
    const athlete = pro ? null : await prisma.athleteUser.findUnique({ where: { email: emailLower } });

    if (!pro && !athlete) {
      recordLoginFailure(emailLower);
      recordLoginFailure(`ip:${ip}`);
      securityMonitor.trackLogin(ip, emailLower, false);
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    // ── Athlete login path (simpler: no 2FA, no risk assessment) ──
    if (athlete) {
      const athletePwdValid = await bcrypt.compare(password, athlete.password);
      if (!athletePwdValid) {
        recordLoginFailure(emailLower);
        recordLoginFailure(`ip:${ip}`);
        securityMonitor.trackLogin(ip, emailLower, false);
        return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
      }

      if (!athlete.emailVerified) {
        return NextResponse.json(
          { error: "Veuillez vérifier votre adresse email avant de vous connecter.", requiresEmailVerification: true, email: athlete.email },
          { status: 403 }
        );
      }

      recordLoginSuccess(emailLower);
      recordLoginSuccess(`ip:${ip}`);
      securityMonitor.trackLogin(ip, emailLower, true);

      const { accessToken, refreshToken } = await createSession(athlete.id, "athlete", ip === "unknown" ? null : ip, userAgent, "athlete");

      const response = NextResponse.json({ message: "Connexion réussie", redirect: "/dashboard/athlete" });
      setAuthCookies(response, accessToken, refreshToken);
      return response;
    }

    // ── Professional login path ──
    // At this point pro is guaranteed non-null (athlete path returned above)
    const proUser = pro!;
    const passwordValid = await bcrypt.compare(password, proUser.password);

    if (!passwordValid) {
      const result = recordLoginFailure(emailLower);
      recordLoginFailure(`ip:${ip}`);
      securityMonitor.trackLogin(ip, emailLower, false);

      // Log security alert if account gets locked
      if (result.locked) {
        prisma.securityAlert.create({
          data: {
            type: "login_locked",
            message: `Compte verrouillé après ${result.failedAttempts} tentatives échouées (niveau ${result.lockLevel}).`,
            ip, userAgent, professionnelId: proUser.id,
          },
        }).catch(() => {});
      }

      const remaining = 5 - result.failedAttempts;
      if (remaining > 0 && remaining <= 2) {
        return NextResponse.json(
          { error: `Identifiants incorrects. ${remaining} tentative(s) restante(s) avant verrouillage.` },
          { status: 401 }
        );
      }

      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    // ── Email verification check ──
    if (!proUser.emailVerified) {
      return NextResponse.json(
        { error: "Veuillez vérifier votre adresse email avant de vous connecter.", requiresEmailVerification: true, email: proUser.email },
        { status: 403 }
      );
    }

    // ── 2FA check ──
    if (proUser.twoFactorEnabled && proUser.totpSecret) {
      if (!totpCode) {
        return NextResponse.json({ requires2FA: true, message: "Code 2FA requis." }, { status: 200 });
      }

      // OTP rate limit
      const otpLimit = checkRateLimit(`otp:${emailLower}`, RATE_LIMITS.otpVerify);
      if (!otpLimit.allowed) {
        const res = NextResponse.json(
          { error: "Trop de tentatives 2FA. Réessayez plus tard.", requires2FA: true, retryAfter: Math.ceil(otpLimit.retryAfterMs / 1000) },
          { status: 429 }
        );
        res.headers.set("Retry-After", retryAfterSeconds(otpLimit.retryAfterMs));
        return res;
      }

      const totp = new OTPAuth.TOTP({
        issuer: "Tuatha",
        label: proUser.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(proUser.totpSecret),
      });

      const delta = totp.validate({ token: totpCode, window: 1 });
      if (delta === null) {
        recordLoginFailure(emailLower);
        return NextResponse.json({ error: "Code 2FA invalide.", requires2FA: true }, { status: 403 });
      }
    }

    // ── Risk assessment ──
    const risk = await assessLoginRisk({ professionnelId: proUser.id, ip, userAgent });

    if (risk.requiresVerification) {
      // Generate a verification code and require re-verification
      const { generateVerifyCode } = await import("@/lib/security");
      const { sendVerificationEmail } = await import("@/lib/email");

      const code = generateVerifyCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.professionnel.update({
        where: { id: proUser.id },
        data: { emailVerifyToken: code, emailVerifyExpires: expires },
      });

      prisma.securityAlert.create({
        data: {
          type: "suspicious_login_blocked",
          message: `Connexion suspecte bloquée (score: ${risk.score}, raisons: ${risk.reasons.join(", ")}).`,
          ip, userAgent, professionnelId: proUser.id,
        },
      }).catch(() => {});

      sendVerificationEmail({ to: proUser.email, prenom: proUser.prenom, code }).catch((err) => {
        console.error("[Login] Failed to send risk verification email:", err);
      });

      return NextResponse.json({
        error: "Connexion suspecte détectée. Un code de vérification a été envoyé à votre email.",
        requiresEmailVerification: true,
        email: proUser.email,
        riskLevel: risk.level,
      }, { status: 403 });
    }

    // ── Success: clear brute-force counters ──
    recordLoginSuccess(emailLower);
    recordLoginSuccess(`ip:${ip}`);
    securityMonitor.trackLogin(ip, emailLower, true);

    const redirectPath = getDashboardPath(proUser.specialite);

    // Create DB-backed session (dual tokens: short access + long refresh)
    const { accessToken, refreshToken, isNewDevice, deviceName } = await createSession(proUser.id, proUser.specialite, ip === "unknown" ? null : ip, userAgent);

    // New device alert (non-blocking)
    if (isNewDevice) {
      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-FR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      prisma.securityAlert.create({
        data: {
          type: "new_device_login",
          message: `Connexion depuis un nouvel appareil : ${deviceName}`,
          ip: ip === "unknown" ? null : ip, userAgent, professionnelId: proUser.id,
        },
      }).catch(() => {});

      sendNewDeviceAlert({
        to: proUser.email, prenom: proUser.prenom, deviceName,
        ip: ip === "unknown" ? null : ip, date: dateStr,
      }).catch((err) => {
        console.error("[Login] Failed to send new device alert:", err);
      });
    }

    const response = NextResponse.json({
      message: "Connexion réussie",
      redirect: redirectPath,
    });

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (error) {
    console.error("Erreur login:", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
