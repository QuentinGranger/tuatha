// ─── Support Ticket API (user-facing) ───
// POST /api/support/ticket — Allows athletes & pros to create support tickets
// GET  /api/support/ticket — List own tickets (athlete or pro)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete, getSessionPro } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

// ─── Security: strict rate limit for ticket creation (3 per hour) ───
const TICKET_RATE = { windowMs: 3_600_000, maxRequests: 3 };
const TICKET_READ_RATE = { windowMs: 60_000, maxRequests: 15 };

const VALID_CATEGORIES = [
  "account",        // Compte & connexion
  "security",       // Sécurité
  "payment",        // Paiement
  "technical",      // Bug / performance
  "pro",            // Problème avec un professionnel
  "data",           // Données / documents
  "rgpd",           // RGPD / confidentialité
  "other",          // Autre
] as const;

// ─── Security: UUID v4 format check ───
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  // ── Rate limit (3 tickets per hour) ──
  const limited = rateLimit(request, TICKET_RATE);
  if (limited) return limited;

  // ── Auth ──
  const athlete = await getSessionAthlete();
  const pro = !athlete ? await getSessionPro() : null;
  if (!athlete && !pro) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const userId = athlete?.id ?? pro?.id;
  const userRole = athlete ? "athlete" : "pro";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = request.headers.get("user-agent")?.slice(0, 500) || null;

  try {
    const body = await request.json();
    const { subject, description, category } = body;

    // ── Honeypot anti-bot: reject if hidden field is filled ──
    if (body._hp_email) {
      console.warn(`[SECURITY] Honeypot triggered on /api/support/ticket from IP=${ip}`);
      // Return success to not alert the bot
      return NextResponse.json({ success: true, message: "Votre demande a bien été envoyée." });
    }

    // ── Input validation ──
    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return NextResponse.json({ error: "Sujet requis (min 3 caractères)." }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json({ error: "Description requise (min 10 caractères)." }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
    }

    // ── Sanitize text inputs (centralized XSS protection) ──
    const subjectResult = sanitizeText(subject, { maxLength: 200, context: "sujet" });
    if (!subjectResult.ok) return NextResponse.json({ error: subjectResult.reason }, { status: 400 });
    const descResult = sanitizeText(description, { maxLength: 2000, context: "description" });
    if (!descResult.ok) return NextResponse.json({ error: descResult.reason }, { status: 400 });
    const cleanSubject = subjectResult.text;
    const cleanDescription = descResult.text;
    if (cleanSubject.length < 3 || cleanDescription.length < 10) {
      return NextResponse.json({ error: "Contenu invalide après nettoyage." }, { status: 400 });
    }

    // ── Anti-flood: max 5 open tickets per user ──
    const where: any = { status: { in: ["open", "in_progress"] } };
    if (athlete) where.athleteUserId = athlete.id;
    else where.professionnelId = pro!.id;

    const openCount = await (prisma as any).supportTicket.count({ where });
    if (openCount >= 5) {
      return NextResponse.json(
        { error: "Vous avez déjà 5 demandes en cours. Attendez qu'elles soient traitées." },
        { status: 429 },
      );
    }

    // ── Create ticket ──
    const ticket = await (prisma as any).supportTicket.create({
      data: {
        subject: cleanSubject,
        description: cleanDescription,
        category,
        priority: "normal",
        status: "open",
        createdByRole: userRole,
        athleteUserId: athlete?.id ?? null,
        professionnelId: pro?.id ?? null,
      },
    });

    // ── Audit trail ──
    console.log(`[SUPPORT] ticket=${ticket.id} by=${userRole}:${userId} cat=${category} ip=${ip} ua=${ua?.slice(0, 80)}`);

    // Do NOT expose ticketId in response (information leakage)
    return NextResponse.json({
      success: true,
      message: "Votre demande a bien été envoyée. Nous reviendrons vers vous rapidement.",
    });
  } catch (error) {
    console.error("POST /api/support/ticket error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, TICKET_READ_RATE);
  if (limited) return limited;

  const athlete = await getSessionAthlete();
  const pro = !athlete ? await getSessionPro() : null;

  if (!athlete && !pro) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const where: any = {};
    if (athlete) where.athleteUserId = athlete.id;
    else if (pro) where.professionnelId = pro.id;

    const tickets = await (prisma as any).supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
      },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("GET /api/support/ticket error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
