import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { foodItemId, name, quantity, unit, kcal, protein, carbs, fat, constraint } = body;
    if (!foodItemId || !name) return NextResponse.json({ error: "foodItemId et name requis" }, { status: 400 });

    const alt = await (prisma as any).nutriAlternative.create({
      data: {
        foodItemId, name,
        quantity: quantity ?? 0,
        unit: unit || "g",
        kcal: kcal ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        constraint: constraint || null,
      },
    });
    return NextResponse.json(alt, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/alternatives error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:alternatives" });
