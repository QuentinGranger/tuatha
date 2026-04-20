import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";
import { logAccess } from "@/lib/privacyGuard";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    logAccess(athleteId, session.id, "view_plan_nutri");
    const plans = await (prisma as any).nutriPlan.findMany({
      where: { athleteId, proId: session.id },
      include: {
        meals: {
          orderBy: { position: "asc" },
          include: {
            items: {
              orderBy: { position: "asc" },
              include: { alternatives: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET /api/nutri/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const body = sanitizeBody(await req.json());
    const { athleteId, name, kcalTarget, proteinTarget, carbsTarget, fatTarget, fiberTarget, saltTarget, waterTarget, proteinPct, carbsPct, fatPct, notePatient, notePro } = body;
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const plan = await (prisma as any).nutriPlan.create({
      data: {
        athleteId,
        proId: session.id,
        name: name || "Plan alimentaire",
        kcalTarget: kcalTarget ?? 2000,
        proteinTarget: proteinTarget ?? 120,
        carbsTarget: carbsTarget ?? 250,
        fatTarget: fatTarget ?? 65,
        fiberTarget: fiberTarget ?? null,
        saltTarget: saltTarget ?? null,
        waterTarget: waterTarget ?? null,
        proteinPct: proteinPct ?? 30,
        carbsPct: carbsPct ?? 40,
        fatPct: fatPct ?? 30,
        notePatient: notePatient || "",
        notePro: notePro || "",
      },
      include: { meals: { include: { items: { include: { alternatives: true } } } } },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:plans" });
