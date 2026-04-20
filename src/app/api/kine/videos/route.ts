import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createKineVideoSchema } from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { sanitizeBody } from "@/lib/sanitize";

// GET /api/kine/videos?category=dos&search=xxx
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const limited = applyRateLimit(`search:${pro.id}`, RATE_LIMITS.search);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = { professionnelId: pro.id };
    if (category) where.category = category;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const videos = await (prisma as any).kineVideo.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(videos);
  } catch (error) {
    console.error("GET /api/kine/videos error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:videos" });

// POST /api/kine/videos
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createKineVideoSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const video = await (prisma as any).kineVideo.create({
      data: {
        title: d.title,
        url: d.url,
        thumbnail: d.thumbnail || null,
        category: d.category,
        duration: d.duration ?? null,
        description: d.description || null,
        professionnelId: pro.id,
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    console.error("POST /api/kine/videos error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:videos" });
