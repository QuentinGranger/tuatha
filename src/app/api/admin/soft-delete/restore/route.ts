// ─── Admin Restore Soft-Deleted Record ───
//
// POST /api/admin/soft-delete/restore
// Body: { model: string, id: string }
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import { restore, type SoftDeleteModel } from "@/lib/softDelete";

const VALID_MODELS: Set<string> = new Set([
  "athlete", "sharedDocument", "athleteVideo", "calendarEvent",
  "kanbanTask", "session", "collabNote", "proMessage",
  "invoice", "kinePlan", "nutriPlan", "medOrdonnance",
  "medProtocol", "cabinet",
]);

function checkAdminAuth(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { model, id } = body;

    if (!model || !id) {
      return NextResponse.json({ error: "model et id requis." }, { status: 400 });
    }

    if (!VALID_MODELS.has(model)) {
      return NextResponse.json(
        { error: `Modèle invalide. Modèles supportés: ${[...VALID_MODELS].join(", ")}` },
        { status: 400 },
      );
    }

    const record = await restore(model as SoftDeleteModel, id, "admin");

    if (!record) {
      return NextResponse.json({ error: "Enregistrement introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      message: `${model}#${id} restauré.`,
      record,
    });
  } catch (error) {
    console.error("POST /api/admin/soft-delete/restore error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
