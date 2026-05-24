import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const [totalInvoices, totalPayments, successPayments, failedPayments, recent] = await Promise.all([
      (prisma as any).invoice.count(),
      (prisma as any).payment.count(),
      (prisma as any).payment.count({ where: { status: "paid" } }),
      (prisma as any).payment.count({ where: { status: "payment_failed" } }),
      (prisma as any).payment.findMany({
        take: 20, orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, status: true, createdAt: true, professionnel: { select: { email: true } } },
      }),
    ]);
    return NextResponse.json({
      totalInvoices, totalPayments, successPayments, failedPayments,
      recent: recent.map((p: any) => ({ ...p, proEmail: p.professionnel?.email })),
    });
  } catch (error) {
    console.error("[ADMIN-PAYMENTS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
