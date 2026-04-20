// ─── Admin Backup API ───
//
// POST /api/admin/backup — Create a new encrypted backup
// GET  /api/admin/backup — List backup history
//
// Protected by ADMIN_SECRET bearer token (for ops/cron scripts).
// Usage: curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" /api/admin/backup

import { NextRequest, NextResponse } from "next/server";
import { backup, type BackupType, type BackupTrigger } from "@/lib/backup";

function checkAdminAuth(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// POST /api/admin/backup — Create backup
export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const type: BackupType = body.type || "full";
    const trigger: BackupTrigger = body.trigger || "manual";

    const result = await backup.createFull(trigger, type);

    if (!result.success) {
      return NextResponse.json(
        { error: "Backup échoué.", detail: result.error, duration: result.duration },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: result.id,
      success: true,
      duration: result.duration,
      manifest: result.manifest,
    });
  } catch (error) {
    console.error("POST /api/admin/backup error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

// GET /api/admin/backup — List history + config
export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const history = await backup.getHistory();
    const config = backup.getConfig();

    return NextResponse.json({ history, config });
  } catch (error) {
    console.error("GET /api/admin/backup error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
