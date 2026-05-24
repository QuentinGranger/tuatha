import { NextRequest, NextResponse } from "next/server";
import { enforceRetention } from "@/lib/dataMinimization";
import { purgeExpired } from "@/lib/softDelete";

export const dynamic = "force-dynamic";

// GET /api/cron/data-retention
// Called weekly via Vercel cron or external scheduler.
// Runs all retention policies (delete/anonymize expired data)
// AND purges soft-deleted records past the 30-day retention window.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Enforce data retention policies (long-term: medical 5y, admin 10y, etc.)
    const retentionResults = await enforceRetention();
    const totalDeleted = retentionResults
      .filter((r) => r.action === "deleted")
      .reduce((s, r) => s + r.affected, 0);
    const totalAnonymized = retentionResults
      .filter((r) => r.action === "anonymized")
      .reduce((s, r) => s + r.affected, 0);

    // 2. Purge soft-deleted records past retention window (30 days default)
    const purgeResults = await purgeExpired();

    console.log(
      `[cron/data-retention] Retention: ${totalDeleted} deleted, ${totalAnonymized} anonymized. ` +
      `Purge: ${JSON.stringify(purgeResults)}`
    );

    return NextResponse.json({
      retention: {
        deleted: totalDeleted,
        anonymized: totalAnonymized,
        details: retentionResults.filter((r) => r.affected > 0),
      },
      purge: purgeResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/data-retention] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
