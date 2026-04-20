// ─── Admin Purge Expired Soft-Deleted Records ───
//
// POST /api/admin/soft-delete/purge
// Permanently deletes records past the retention period (30 days).
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import { purgeExpired } from "@/lib/softDelete";

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
    const results = await purgeExpired();
    const total = results.reduce((sum, r) => sum + r.purged, 0);

    return NextResponse.json({
      message: `${total} enregistrement(s) purgé(s) définitivement.`,
      results,
    });
  } catch (error) {
    console.error("POST /api/admin/soft-delete/purge error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
