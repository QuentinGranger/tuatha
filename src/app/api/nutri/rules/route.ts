import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (_req, ctx) => {
  try {
    const session = ctx.session;

    const rules = await (prisma as any).nutriRule.findMany({
      where: { proId: session.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET /api/nutri/rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:rules" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const body = sanitizeBody(await req.json());
    const { label, condition } = body;
    if (!label || !condition) return NextResponse.json({ error: "label et condition requis" }, { status: 400 });

    const rule = await (prisma as any).nutriRule.create({
      data: { proId: session.id, label, condition, active: true },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:rules" });

export const PATCH = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const body = sanitizeBody(await req.json());
    const { id, active } = body;
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    // IDOR check: verify rule belongs to this pro
    const existing = await (prisma as any).nutriRule.findFirst({ where: { id, proId: session.id } });
    if (!existing) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    const updated = await (prisma as any).nutriRule.update({
      where: { id },
      data: { active },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/nutri/rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:rules" });
