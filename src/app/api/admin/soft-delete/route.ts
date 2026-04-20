// ─── Admin Soft-Delete Management API ───
//
// GET    /api/admin/soft-delete              — Status: deleted counts per model + config
// POST   /api/admin/soft-delete/purge        — Purge expired records (past retention)
// POST   /api/admin/soft-delete/restore      — Restore a specific record
// GET    /api/admin/soft-delete/deleted       — List deleted records for a model
//
// Protected by ADMIN_SECRET bearer token.

import { NextRequest, NextResponse } from "next/server";
import {
  getDeletedCounts,
  getConfig,
} from "@/lib/softDelete";

function checkAdminAuth(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// GET /api/admin/soft-delete — Status overview
export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const [counts, config] = await Promise.all([
      getDeletedCounts(),
      Promise.resolve(getConfig()),
    ]);

    const totalDeleted = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      totalDeleted,
      counts,
      config,
    });
  } catch (error) {
    console.error("GET /api/admin/soft-delete error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
