// ─── Droits Utilisateur RGPD — API ───
//
// GET  /api/athletes/[id]/rights          — Historique des demandes de droits
// POST /api/athletes/[id]/rights          — Exercer un droit (accès, rectification, effacement)
//
// Body POST: { right: "access" | "rectification" | "erasure", corrections?: {...}, reason?: string }
//
// Only the owner professional can exercise rights on behalf of the athlete.

import { NextRequest, NextResponse } from "next/server";
import { withAthleteAccess } from "@/lib/withAthleteAccess";
import { userRights } from "@/lib/userRights";

// GET — history of rights requests for this athlete
export const GET = withAthleteAccess(async (_request, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;

    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({ error: "Accès réservé au professionnel référent." }, { status: 403 });
    }

    const history = await userRights.getHistory(id);
    return NextResponse.json({ athleteId: id, history });
  } catch (error) {
    console.error("GET /api/athletes/[id]/rights error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });

// POST — exercise a right
export const POST = withAthleteAccess(async (request, ctx, routeCtx) => {
  try {
    const session = ctx.session;
    const { id } = await routeCtx!.params;

    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({
        error: "Seul le professionnel référent peut exercer les droits pour cet athlète.",
      }, { status: 403 });
    }

    const body = await request.json();
    const { right, corrections, reason } = body;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const rightCtx = { ip, userAgent };

    // ─── Art. 15 — Droit d'accès ───
    if (right === "access") {
      const result = await userRights.access(id, session.id, rightCtx);
      return NextResponse.json({
        message: "Droit d'accès exercé (Art. 15 RGPD). Export complet des données personnelles.",
        requestId: result.requestId,
        data: result.data,
        exportedAt: result.exportedAt,
      });
    }

    // ─── Art. 16 — Droit de rectification ───
    if (right === "rectification") {
      if (!corrections || typeof corrections !== "object" || Object.keys(corrections).length === 0) {
        return NextResponse.json({
          error: "Le champ 'corrections' est requis (objet clé-valeur des champs à corriger).",
          rectifiableFields: [
            "name", "contactEmail", "contactPhone", "dateNaissance",
            "taille", "poids", "sport", "objectif", "motif",
            "bodyZone", "frequence", "canalCommunication",
          ],
        }, { status: 400 });
      }

      const result = await userRights.rectify(id, session.id, corrections, rightCtx);
      return NextResponse.json({
        message: result.corrected.length > 0
          ? `Droit de rectification exercé (Art. 16 RGPD). ${result.corrected.length} champ(s) corrigé(s).`
          : "Aucun champ rectifiable trouvé dans la demande.",
        requestId: result.requestId,
        corrected: result.corrected,
        unchanged: result.unchanged,
        note: result.unchanged.length > 0
          ? "Les champs cliniques (notes, traitements, antécédents) doivent être corrigés directement par le professionnel dans le dossier."
          : undefined,
      });
    }

    // ─── Art. 17 — Droit à l'effacement ───
    if (right === "erasure") {
      if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
        return NextResponse.json({
          error: "Un motif est requis pour l'effacement (minimum 5 caractères).",
        }, { status: 400 });
      }

      const result = await userRights.erase(id, session.id, reason.trim(), rightCtx);

      if (!result.erased && result.reason) {
        return NextResponse.json({
          message: "Effacement partiel appliqué (anonymisation des données personnelles).",
          requestId: result.requestId,
          erased: false,
          anonymizedFields: result.anonymizedFields,
          reason: result.reason,
        }, { status: 200 });
      }

      return NextResponse.json({
        message: "Droit à l'effacement exercé (Art. 17 RGPD). Données anonymisées de manière irréversible.",
        requestId: result.requestId,
        erased: true,
        anonymizedFields: result.anonymizedFields,
      });
    }

    return NextResponse.json({
      error: "Droit non reconnu. Droits disponibles: access, rectification, erasure.",
    }, { status: 400 });
  } catch (error) {
    console.error("POST /api/athletes/[id]/rights error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });
