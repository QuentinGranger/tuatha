// ─── Athlete Anonymization (RGPD Droit à l'oubli) ───
//
// POST /api/athletes/[id]/anonymize
// Body: { reason: string }
//
// ⚠️ IRREVERSIBLE — Replaces all PII with anonymized placeholders.
// Only the owner professional can anonymize an athlete.

import { NextRequest, NextResponse } from "next/server";
import { withAthleteAccess } from "@/lib/withAthleteAccess";
import { anonymizeAthlete } from "@/lib/dataMinimization";

export const POST = withAthleteAccess(async (request, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    // Only owner can anonymize
    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({
        error: "Seul le professionnel référent peut anonymiser un athlète.",
      }, { status: 403 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json({
        error: "Un motif d'anonymisation est requis (minimum 5 caractères).",
      }, { status: 400 });
    }

    const result = await anonymizeAthlete(id, session.id, reason.trim());

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Athlète anonymisé. Cette action est irréversible.",
      anonymizedFields: result.anonymized,
    });
  } catch (error) {
    console.error("POST /api/athletes/[id]/anonymize error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });
