import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerifyCode } from "@/lib/security";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rateLimit";
import { validateBody, verifyEmailSchema, resendVerifySchema } from "@/lib/validation";
import { getDashboardPath } from "@/lib/specialites";
import { computeAccountStatus } from "@/lib/accountStatus";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

// POST — Verify email with code
export async function POST(request: NextRequest) {
  try {
    const ip = getIP(request);

    // Rate limit OTP verification attempts
    const otpLimit = checkRateLimit(`otp-verify:${ip}`, RATE_LIMITS.otpVerify);
    if (!otpLimit.allowed) {
      const res = NextResponse.json(
        { error: "Trop de tentatives. R\u00e9essayez plus tard.", retryAfter: Math.ceil(otpLimit.retryAfterMs / 1000) },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(otpLimit.retryAfterMs));
      return res;
    }

    const parsed = validateBody(await request.json(), verifyEmailSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { email, code } = parsed.data;

    const pro = await prisma.professionnel.findUnique({ where: { email } });
    const athlete = pro ? null : await prisma.athleteUser.findUnique({ where: { email } });

    if (!pro && !athlete) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }

    const { createSession, setAuthCookies } = await import("@/lib/session");
    const verifyIp = getIP(request);
    const userAgent = request.headers.get("user-agent") || null;
    const ipVal = verifyIp === "unknown" ? null : verifyIp;

    // ── Professional path ──
    if (pro) {
      if (pro.emailVerified) {
        const { accessToken, refreshToken } = await createSession(pro.id, pro.specialite, ipVal, userAgent);
        const redirect = getDashboardPath(pro.specialite);
        const response = NextResponse.json({ message: "Email déjà vérifié.", verified: true, redirect });
        setAuthCookies(response, accessToken, refreshToken);
        return response;
      }

      if (!pro.emailVerifyToken || !pro.emailVerifyExpires) {
        return NextResponse.json({ error: "Aucun code en attente. Demandez un nouveau code." }, { status: 400 });
      }
      if (new Date() > pro.emailVerifyExpires) {
        return NextResponse.json({ error: "Code expiré. Demandez un nouveau code." }, { status: 410 });
      }
      if (pro.emailVerifyToken !== code) {
        return NextResponse.json({ error: "Code invalide." }, { status: 403 });
      }

      const updatedPro = await prisma.professionnel.update({
        where: { id: pro.id },
        data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
      });

      // Recompute account status after email verification
      const newStatus = computeAccountStatus(updatedPro);
      if (newStatus !== updatedPro.accountStatus) {
        await prisma.professionnel.update({
          where: { id: pro.id },
          data: { accountStatus: newStatus },
        });
      }

      const { accessToken, refreshToken } = await createSession(pro.id, pro.specialite, ipVal, userAgent);
      const redirect = getDashboardPath(pro.specialite);
      const response = NextResponse.json({ message: "Email vérifié avec succès !", verified: true, redirect });
      setAuthCookies(response, accessToken, refreshToken);
      return response;
    }

    // ── Athlete path ──
    if (athlete!.emailVerified) {
      const { accessToken, refreshToken } = await createSession(athlete!.id, "athlete", ipVal, userAgent, "athlete");
      const response = NextResponse.json({ message: "Email déjà vérifié.", verified: true, redirect: "/dashboard/athlete" });
      setAuthCookies(response, accessToken, refreshToken);
      return response;
    }

    if (!athlete!.emailVerifyToken || !athlete!.emailVerifyExpires) {
      return NextResponse.json({ error: "Aucun code en attente. Demandez un nouveau code." }, { status: 400 });
    }
    if (new Date() > athlete!.emailVerifyExpires) {
      return NextResponse.json({ error: "Code expiré. Demandez un nouveau code." }, { status: 410 });
    }
    if (athlete!.emailVerifyToken !== code) {
      return NextResponse.json({ error: "Code invalide." }, { status: 403 });
    }

    await prisma.athleteUser.update({
      where: { id: athlete!.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });

    const { accessToken, refreshToken } = await createSession(athlete!.id, "athlete", ipVal, userAgent, "athlete");
    const response = NextResponse.json({ message: "Email vérifié avec succès !", verified: true, redirect: "/dashboard/athlete" });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    console.error("verify-email error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// PUT — Resend verification code
export async function PUT(request: NextRequest) {
  try {
    const ip = getIP(request);

    // Rate limit resend (1 per minute per IP)
    const resendLimit = checkRateLimit(`otp-resend:${ip}`, RATE_LIMITS.otpResend);
    if (!resendLimit.allowed) {
      const res = NextResponse.json(
        { error: "Veuillez patienter avant de renvoyer un code.", retryAfter: Math.ceil(resendLimit.retryAfterMs / 1000) },
        { status: 429 }
      );
      res.headers.set("Retry-After", retryAfterSeconds(resendLimit.retryAfterMs));
      return res;
    }

    const parsed = validateBody(await request.json(), resendVerifySchema);
    if (!parsed.success) return parsed.errorResponse;
    const { email } = parsed.data;

    const pro = await prisma.professionnel.findUnique({ where: { email } });
    const athlete = pro ? null : await prisma.athleteUser.findUnique({ where: { email } });

    if (!pro && !athlete) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }

    const user = pro || athlete!;

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email déjà vérifié." });
    }

    // Rate limit: don't allow resend within 60 seconds
    if (user.emailVerifyExpires) {
      const lastSent = new Date(user.emailVerifyExpires.getTime() - 15 * 60 * 1000);
      const elapsed = Date.now() - lastSent.getTime();
      if (elapsed < 60_000) {
        const wait = Math.ceil((60_000 - elapsed) / 1000);
        return NextResponse.json(
          { error: `Veuillez patienter ${wait}s avant de renvoyer un code.` },
          { status: 429 }
        );
      }
    }

    const newCode = generateVerifyCode();
    const newExpires = new Date(Date.now() + 15 * 60 * 1000);

    if (pro) {
      await prisma.professionnel.update({
        where: { id: pro.id },
        data: { emailVerifyToken: newCode, emailVerifyExpires: newExpires },
      });
    } else {
      await prisma.athleteUser.update({
        where: { id: athlete!.id },
        data: { emailVerifyToken: newCode, emailVerifyExpires: newExpires },
      });
    }

    await sendVerificationEmail({ to: email, prenom: user.prenom, code: newCode });

    return NextResponse.json({ message: "Nouveau code envoyé." });
  } catch (error) {
    console.error("resend verify-email error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
