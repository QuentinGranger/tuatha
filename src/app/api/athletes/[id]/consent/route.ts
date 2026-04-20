// ─── Consent History & Management API ───
//
// GET  /api/athletes/[id]/consent          — Consent status + full audit trail
// POST /api/athletes/[id]/consent          — Grant or revoke a specific consent type
//
// Only the owner professional can access/modify consent.

import { NextRequest, NextResponse } from "next/server";
import { withAthleteAccess } from "@/lib/withAthleteAccess";
import { consent, type ConsentType, type ConsentMethod } from "@/lib/consent";

const VALID_TYPES = new Set<ConsentType>(["general", "partage", "export", "data_processing"]);
const VALID_METHODS = new Set<ConsentMethod>(["verbal", "written", "digital", "email"]);

// GET /api/athletes/[id]/consent — consent status + history
export const GET = withAthleteAccess(async (_request, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;

    // Only owner can view full consent trail
    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({ error: "Accès réservé au professionnel référent." }, { status: 403 });
    }

    const [status, history] = await Promise.all([
      consent.getStatus(id),
      consent.getHistory(id),
    ]);

    return NextResponse.json({ status, history });
  } catch (error) {
    console.error("GET /api/athletes/[id]/consent error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });

// POST /api/athletes/[id]/consent — grant or revoke consent
// Body: { type: ConsentType, granted: boolean, method?: ConsentMethod, purpose?: string }
export const POST = withAthleteAccess(async (request, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    // Only owner can modify consent
    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({ error: "Seul le professionnel référent peut gérer le consentement." }, { status: 403 });
    }

    const body = await request.json();
    const { type, granted, method, purpose } = body;

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json({
        error: `Type de consentement invalide. Types valides: ${[...VALID_TYPES].join(", ")}`,
      }, { status: 400 });
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json({ error: "Le champ 'granted' (boolean) est requis." }, { status: 400 });
    }

    if (method && !VALID_METHODS.has(method)) {
      return NextResponse.json({
        error: `Méthode invalide. Méthodes valides: ${[...VALID_METHODS].join(", ")}`,
      }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const consentCtx = {
      ip,
      userAgent,
      method: (method as ConsentMethod) || "digital",
      purpose: purpose || undefined,
    };

    let result;
    if (granted) {
      result = await consent.grant(type as ConsentType, id, session.id, consentCtx);
    } else {
      result = await consent.revoke(type as ConsentType, id, session.id, consentCtx);
    }

    return NextResponse.json({
      message: granted
        ? `Consentement "${type}" enregistré.`
        : `Consentement "${type}" révoqué.`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/athletes/[id]/consent error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });
