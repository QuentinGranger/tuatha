import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const type = req.nextUrl.searchParams.get("type") || "meal";

    if (type === "day") {
      const templates = await (prisma as any).nutriDayTemplate.findMany({
        where: { proId: session.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(templates);
    }

    const templates = await (prisma as any).nutriMealTemplate.findMany({
      where: { proId: session.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/nutri/templates error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:templates" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const body = sanitizeBody(await req.json());
    const { type, name, data } = body;
    if (!name || !data) return NextResponse.json({ error: "name et data requis" }, { status: 400 });

    if (type === "day") {
      const tpl = await (prisma as any).nutriDayTemplate.create({
        data: { proId: session.id, name, meals: JSON.stringify(data) },
      });
      return NextResponse.json(tpl, { status: 201 });
    }

    const tpl = await (prisma as any).nutriMealTemplate.create({
      data: { proId: session.id, name, items: JSON.stringify(data) },
    });
    return NextResponse.json(tpl, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/templates error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:templates" });
