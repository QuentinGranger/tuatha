// ─── Admin Data Minimization API ───
//
// GET  /api/admin/data-minimization          — Status: retention policies, anonymized counts
// POST /api/admin/data-minimization/enforce  — Run retention enforcement
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getMinimizationStatus } from "@/lib/dataMinimization";

function checkAdminAuth(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const status = await getMinimizationStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("GET /api/admin/data-minimization error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
