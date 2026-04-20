import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { planId, name, time, position, rule } = body;
    if (!planId) return NextResponse.json({ error: "planId requis" }, { status: 400 });

    const meal = await (prisma as any).nutriMeal.create({
      data: {
        planId,
        name: name || "Repas",
        time: time || null,
        position: position ?? 0,
        rule: rule || null,
      },
      include: { items: { include: { alternatives: true } } },
    });
    return NextResponse.json(meal, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/meals error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:meals" });
