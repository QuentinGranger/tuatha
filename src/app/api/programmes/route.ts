import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sanitizeBody } from "@/lib/sanitize";
import { logAccess } from "@/lib/privacyGuard";

// GET /api/programmes — list all sessions
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const athleteId = request.nextUrl.searchParams.get("athleteId");
    const status = request.nextUrl.searchParams.get("status");

    if (athleteId) logAccess(athleteId, pro.id, "view_programme");
    const sessions = await prisma.session.findMany({
      where: {
        professionnelId: pro.id,
        ...(athleteId ? { athleteId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        athlete: { select: { id: true, name: true, sport: true, status: true } },
        blocks: { include: { exercises: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET /api/programmes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "sessions" });

// POST /api/programmes — create a new session
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const body = sanitizeBody(await request.json());
    const { name, date, time, lieu, athleteId, objectif, tags, notePro, status } = body;

    if (!name || !date) {
      return NextResponse.json({ error: "Nom et date requis" }, { status: 400 });
    }

    // Validate athleteId exists and pro has access (own or shared)
    let validAthleteId: string | null = null;
    if (athleteId) {
      // Own athlete
      let athlete = await prisma.athlete.findFirst({
        where: { id: athleteId, professionnelId: pro.id },
        select: { id: true },
      });
      // Shared athlete via ProConnection
      if (!athlete) {
        const shared = await (prisma as any).proConnection.findFirst({
          where: { connectedProId: pro.id, athleteId, status: "connecte" },
          select: { athleteId: true },
        });
        if (shared) {
          athlete = await prisma.athlete.findFirst({
            where: { id: athleteId },
            select: { id: true },
          });
        }
      }
      if (!athlete) {
        return NextResponse.json({ error: "Athlète introuvable" }, { status: 400 });
      }
      validAthleteId = athlete.id;
    }

    const session = await prisma.session.create({
      data: {
        name,
        date: new Date(date),
        time: time || null,
        lieu: lieu || null,
        status: status || "brouillon",
        visibleAthlete: (status && status !== "brouillon") ? true : false,
        athleteId: validAthleteId,
        objectif: objectif || null,
        tags: tags || [],
        notePro: notePro || null,
        professionnelId: pro.id,
      },
      include: {
        athlete: { select: { id: true, name: true, sport: true, status: true } },
        blocks: { include: { exercises: true } },
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/programmes error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}, { resource: "sessions" });
