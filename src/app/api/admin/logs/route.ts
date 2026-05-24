import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [totalLogs, recent24h, totalAccessLogs, logs] = await Promise.all([
      (prisma as any).adminLog.count(),
      (prisma as any).adminLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      (prisma as any).athleteAccessLog.count(),
      (prisma as any).adminLog.findMany({
        take: 50, orderBy: { createdAt: "desc" },
        select: { id: true, action: true, detail: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ totalLogs, recent24h, totalAccessLogs, logs });
  } catch (error) {
    console.error("[ADMIN-LOGS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
