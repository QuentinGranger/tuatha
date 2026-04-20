import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const POST = withAuth(async (req, _ctx) => {
  try {
    const body = sanitizeBody(await req.json());
    const { mealId, name, quantity, unit, kcal, protein, carbs, fat, category, mandatory, position } = body;
    if (!mealId || !name) return NextResponse.json({ error: "mealId et name requis" }, { status: 400 });

    const item = await (prisma as any).nutriFoodItem.create({
      data: {
        mealId, name,
        quantity: quantity ?? 0,
        unit: unit || "g",
        kcal: kcal ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        category: category || "autre",
        mandatory: mandatory ?? true,
        position: position ?? 0,
      },
      include: { alternatives: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/food-items error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:food-items" });
