import { prisma } from "@/lib/prisma";
import { parseDevice } from "@/lib/session";

// ─── Risk scoring for login attempts ───

export interface RiskAssessment {
  score: number;         // 0-100 (0 = safe, 100 = very risky)
  level: "low" | "medium" | "high" | "critical";
  reasons: string[];
  requiresVerification: boolean;
}

interface LoginContext {
  professionnelId: string;
  ip: string | null;
  userAgent: string | null;
}

export async function assessLoginRisk(ctx: LoginContext): Promise<RiskAssessment> {
  const reasons: string[] = [];
  let score = 0;

  const device = parseDevice(ctx.userAgent);

  // 1. Check if device is known
  const knownDevice = await prisma.authSession.findFirst({
    where: {
      professionnelId: ctx.professionnelId,
      deviceHash: device.hash,
      revoked: false,
    },
  });

  if (!knownDevice) {
    score += 10;
    reasons.push("Nouvel appareil détecté");
  }

  // 2. Check if IP is known
  if (ctx.ip) {
    const knownIP = await prisma.authSession.findFirst({
      where: {
        professionnelId: ctx.professionnelId,
        ip: ctx.ip,
      },
    });

    if (!knownIP) {
      score += 10;
      reasons.push("Adresse IP inconnue");

      // 3. Check for impossible travel: if last session was from a different IP very recently
      const recentSession = await prisma.authSession.findFirst({
        where: {
          professionnelId: ctx.professionnelId,
          revoked: false,
          lastActiveAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // last 30min
        },
        orderBy: { lastActiveAt: "desc" },
      });

      if (recentSession && recentSession.ip && recentSession.ip !== ctx.ip) {
        // Active session from different IP within 30 min = suspicious
        score += 30;
        reasons.push("Connexion depuis une IP différente alors qu'une session est active (voyage impossible)");
      }
    }
  } else {
    score += 5;
    reasons.push("Adresse IP non détectable");
  }

  // 4. Check for recent security alerts (password resets, rate limits)
  const recentAlerts = await prisma.securityAlert.count({
    where: {
      professionnelId: ctx.professionnelId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      type: { in: ["password_changed", "login_locked"] },
    },
  });

  if (recentAlerts > 0) {
    score += 15 * Math.min(recentAlerts, 3);
    reasons.push(`${recentAlerts} alerte(s) de sécurité dans les 24h`);
  }

  // 5. Check time of day (unusual hours: 2am-5am local time — rough heuristic)
  const hour = new Date().getUTCHours() + 1; // CET approximation
  if (hour >= 2 && hour <= 5) {
    score += 10;
    reasons.push("Connexion à une heure inhabituelle");
  }

  // Determine level
  let level: RiskAssessment["level"];
  if (score >= 60) level = "critical";
  else if (score >= 40) level = "high";
  else if (score >= 20) level = "medium";
  else level = "low";

  const requiresVerification = score >= 50;

  return { score, level, reasons, requiresVerification };
}
