// ─── Admin Retention Enforcement ───
//
// POST /api/admin/data-minimization/enforce
// Runs all retention policies and deletes/anonymizes expired data.
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import { enforceRetention } from "@/lib/dataMinimization";

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
    const results = await enforceRetention();
    const totalDeleted = results.filter(r => r.action === "deleted").reduce((s, r) => s + r.affected, 0);
    const totalAnonymized = results.filter(r => r.action === "anonymized").reduce((s, r) => s + r.affected, 0);

    return NextResponse.json({
      message: `Rétention appliquée: ${totalDeleted} supprimé(s), ${totalAnonymized} anonymisé(s).`,
      results,
    });
  } catch (error) {
    console.error("POST /api/admin/data-minimization/enforce error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
