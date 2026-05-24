import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { softDelete } from "@/lib/softDelete";
import { randomUUID } from "crypto";
import { secrets } from "@/lib/vault";
import { signFilePathInRecords } from "@/lib/signedUrl";

// GET /api/athlete-videos?athleteId=xxx — list videos for an athlete
export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;

    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId");

    const where: any = { professionnelId: session.id, deletedAt: null };
    if (athleteId) where.athleteId = athleteId;

    const videos = await (prisma as any).athleteVideo.findMany({
      where,
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(signFilePathInRecords(videos, session.id));
  } catch (error) {
    console.error("GET /api/athlete-videos error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athlete-videos" });

// POST /api/athlete-videos/generate-link — generate upload token for an athlete
export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;

    const { athleteId } = await req.json();
    if (!athleteId) return NextResponse.json({ error: "Athlète requis" }, { status: 400 });

    // Verify athlete belongs to this pro
    const athlete = await (prisma as any).athlete.findFirst({
      where: { id: athleteId, professionnelId: session.id },
      select: { id: true, name: true },
    });
    if (!athlete) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });

    const token = randomUUID();
    const baseUrl = secrets.appUrl();
    const uploadUrl = `${baseUrl}/upload-video/${token}`;

    // Persist token for validation on upload (expires in 24h)
    await (prisma as any).videoUploadToken.create({
      data: {
        token,
        athleteId,
        professionnelId: session.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      token,
      uploadUrl,
      athleteId,
      athleteName: athlete.name,
      professionnelId: session.id,
    });
  } catch (error) {
    console.error("POST /api/athlete-videos error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athlete-videos" });

// DELETE /api/athlete-videos?id=xxx — delete a video
export const DELETE = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const video = await (prisma as any).athleteVideo.findUnique({ where: { id } });
    if (!video) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    if (video.professionnelId !== session.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Soft-delete (file preserved on disk for recovery during retention period)
    await softDelete("athleteVideo", id, session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/athlete-videos error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athlete-videos" });
