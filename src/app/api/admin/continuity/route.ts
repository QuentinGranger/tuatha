// ─── Admin Continuity API ───
//
// GET /api/admin/continuity — RPO/RTO compliance status
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import { continuity } from "@/lib/continuity";

function checkAdminAuth(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// GET /api/admin/continuity — Full RPO/RTO status
export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const status = await continuity.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("GET /api/admin/continuity error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
