import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriAlternative, notFound } from "@/lib/idor";

export const DELETE = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriAlternative(id, pro.id)) return notFound("Alternative introuvable");

    await (prisma as any).nutriAlternative.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nutri/alternatives/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alternatives" });
