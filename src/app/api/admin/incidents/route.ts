import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [total, recent24h, unresolved, alerts] = await Promise.all([
      (prisma as any).securityAlert.count(),
      (prisma as any).securityAlert.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      (prisma as any).securityAlert.count({ where: { resolved: false } }),
      (prisma as any).securityAlert.findMany({
        take: 30, orderBy: { createdAt: "desc" },
        select: { id: true, type: true, level: true, message: true, resolved: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ total, recent24h, unresolved, alerts });
  } catch (error) {
    console.error("[ADMIN-INCIDENTS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
