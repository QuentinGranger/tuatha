import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createAlertRuleSchema, updateAlertRuleSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/kine/alert-rules
export const GET = withAuth(async (_request, ctx) => {
  try {
    const pro = ctx.session;

    const rules = await (prisma as any).kineAlertRule.findMany({
      where: { professionnelId: pro.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET /api/kine/alert-rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alert-rules" });

// POST /api/kine/alert-rules — create or update a rule
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createAlertRuleSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    // Upsert: one rule per type per pro
    const existing = await (prisma as any).kineAlertRule.findFirst({
      where: { professionnelId: pro.id, ruleType: d.ruleType },
    });

    if (existing) {
      const updated = await (prisma as any).kineAlertRule.update({
        where: { id: existing.id },
        data: {
          threshold: d.threshold,
          thresholdDays: d.thresholdDays,
          active: d.active,
        },
      });
      return NextResponse.json(updated);
    }

    const rule = await (prisma as any).kineAlertRule.create({
      data: {
        ruleType: d.ruleType,
        threshold: d.threshold,
        thresholdDays: d.thresholdDays,
        active: d.active,
        professionnelId: pro.id,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST /api/kine/alert-rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alert-rules" });

// PATCH /api/kine/alert-rules — toggle active / update threshold
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), updateAlertRuleSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { id, active, threshold, thresholdDays } = parsed.data;

    const existing = await (prisma as any).kineAlertRule.findUnique({ where: { id } });
    if (!existing || existing.professionnelId !== pro.id)
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    const data: any = {};
    if (active !== undefined) data.active = active;
    if (threshold !== undefined) data.threshold = threshold;
    if (thresholdDays !== undefined) data.thresholdDays = thresholdDays;

    const updated = await (prisma as any).kineAlertRule.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/kine/alert-rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:alert-rules" });
