// ─── Athlete Access Log (RGPD Traçabilité) ───
//
// Logs all data access actions performed by the athlete on their own data.
// This fulfills RGPD transparency requirements by enabling the athlete
// to see who accessed what and when.

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export type AthleteAction =
  | "view_profile"
  | "view_messages"
  | "view_documents"
  | "view_plans"
  | "view_ordonnances"
  | "view_vitals"
  | "view_health_data"
  | "export_data"
  | "update_profile"
  | "update_privacy"
  | "delete_document"
  | "connect_wearable"
  | "disconnect_wearable"
  | "sync_health_data"
  | "security_report"
  | "message_report"
  | "block_pro"
  | "delete_ai_summaries";

/**
 * Log an athlete-side data access event.
 * Non-blocking — failures are silently caught to avoid disrupting the main flow.
 */
export async function logAthleteAccess(
  athleteUserId: string,
  action: AthleteAction,
  resource?: string,
): Promise<void> {
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const userAgent = hdrs.get("user-agent") || null;

    await (prisma as any).athleteAccessLog.create({
      data: {
        athleteUserId,
        action,
        resource: resource || null,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error("[AthleteAccessLog] Failed to log:", error);
  }
}
