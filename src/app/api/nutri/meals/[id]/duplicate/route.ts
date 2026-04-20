import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownNutriMeal, notFound } from "@/lib/idor";

export const POST = withAuth(async (_req, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    if (!await ownNutriMeal(id, pro.id)) return notFound("Repas introuvable");

    const meal = await (prisma as any).nutriMeal.findUnique({
      where: { id },
      include: { items: { include: { alternatives: true } } },
    });
    if (!meal) return NextResponse.json({ error: "Repas introuvable" }, { status: 404 });

    const copy = await (prisma as any).nutriMeal.create({
      data: {
        planId: meal.planId,
        name: `${meal.name} (copie)`,
        time: meal.time,
        position: meal.position + 1,
        rule: meal.rule,
        items: {
          create: meal.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            category: item.category,
            mandatory: item.mandatory,
            position: item.position,
            alternatives: {
              create: item.alternatives.map((alt: any) => ({
                name: alt.name,
                quantity: alt.quantity,
                unit: alt.unit,
                kcal: alt.kcal,
                protein: alt.protein,
                carbs: alt.carbs,
                fat: alt.fat,
                constraint: alt.constraint,
              })),
            },
          })),
        },
      },
      include: { items: { include: { alternatives: true } } },
    });
    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/meals/[id]/duplicate error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:meals" });
