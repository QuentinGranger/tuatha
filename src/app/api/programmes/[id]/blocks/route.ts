import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { ownBlock, notFound } from "@/lib/idor";
import { sanitizeBody } from "@/lib/sanitize";

// POST /api/programmes/[id]/blocks — add a block
export const POST = withAuth(async (request, ctx, routeCtx) => {
  try {
    const pro = ctx.session;
    const { id } = await routeCtx!.params;
    const session = await prisma.session.findFirst({ where: { id, professionnelId: pro.id } });
    if (!session) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });

    const body = sanitizeBody(await request.json());
    const maxPos = await prisma.exerciseBlock.count({ where: { sessionId: id } });

    const block = await prisma.exerciseBlock.create({
      data: {
        name: body.name || "Main",
        position: maxPos,
        sessionId: id,
      },
      include: { exercises: true },
    });

    return NextResponse.json(block, { status: 201 });
  } catch (error) {
    console.error("POST /api/programmes/[id]/blocks error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// DELETE /api/programmes/[id]/blocks — delete a block by blockId in body
export const DELETE = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const { blockId } = await request.json();
    if (!blockId) return NextResponse.json({ error: "blockId requis" }, { status: 400 });
    if (!await ownBlock(blockId, pro.id)) return notFound("Bloc introuvable");

    await prisma.exerciseBlock.delete({ where: { id: blockId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/programmes/[id]/blocks error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });
