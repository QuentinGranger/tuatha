import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { resolveDataScopes, meetsActionLevel, OWNER_SCOPES, type DataCategory, type ActionLevel } from "@/lib/abac";
import { redactRecordsSync, redactRecordSync } from "@/lib/redaction";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { checkSharingConsent } from "@/lib/consentCheck";

// GET /api/reseau/shared?athleteId=X&proId=Y
// Returns another pro's shared data for an athlete, respecting ProConnection permissions
export const GET = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;
    const limited = applyRateLimit(`heavy:${session.id}`, RATE_LIMITS.heavyQuery);
    if (limited) return limited;

    const athleteId = request.nextUrl.searchParams.get("athleteId");
    const proId = request.nextUrl.searchParams.get("proId");
    if (!athleteId || !proId) return NextResponse.json({ error: "athleteId et proId requis" }, { status: 400 });

    // Consent check: athlete must have consented to external sharing
    const consent = await checkSharingConsent(athleteId);
    if (!consent.granted) {
      return NextResponse.json({ error: consent.reason, consentRequired: true }, { status: 403 });
    }

    // Find all athlete IDs with the same name (dedup logic)
    const selectedAthlete = await (prisma as any).athlete.findUnique({ where: { id: athleteId }, select: { name: true } });
    let athleteIds = [athleteId];
    if (selectedAthlete) {
      const sameNameAthletes = await (prisma as any).athlete.findMany({
        where: { name: { equals: selectedAthlete.name, mode: "insensitive" } },
        select: { id: true },
      });
      athleteIds = [...new Set(sameNameAthletes.map((a: any) => a.id))] as string[];
    }

    // Find the ProConnection to check permissions
    // Case 1: proId is the owner and I'm connected → permissions on the connection apply to me
    // Case 2: I'm the owner and proId is connected → I can see everything (owner)
    const connectionAsConnected = await (prisma as any).proConnection.findFirst({
      where: {
        athleteId: { in: athleteIds },
        ownerProId: proId,
        connectedProId: session.id,
        status: "connecte",
      },
    });

    const connectionAsOwner = await (prisma as any).proConnection.findFirst({
      where: {
        athleteId: { in: athleteIds },
        ownerProId: session.id,
        connectedProId: proId,
        status: "connecte",
      },
    });

    if (!connectionAsConnected && !connectionAsOwner) {
      return NextResponse.json({ error: "Aucune connexion active" }, { status: 403 });
    }

    // Check expiration on the connection where I am the connected party
    if (connectionAsConnected && connectionAsConnected.expiresAt && new Date(connectionAsConnected.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Votre accès a expiré. Demandez un renouvellement.", expired: true }, { status: 403 });
    }

    // Resolve granular data scopes
    const scopes = connectionAsOwner
      ? OWNER_SCOPES
      : resolveDataScopes(connectionAsConnected);

    // Legacy compat object for frontend
    const perms = {
      readProgramme: meetsActionLevel(scopes.entrainement, "read"),
      readIndicateurs: meetsActionLevel(scopes.indicateurs, "read"),
      readBlessures: meetsActionLevel(scopes.blessures, "read"),
      readDocuments: meetsActionLevel(scopes.documents, "read"),
      readConstantes: meetsActionLevel(scopes.constantes, "read"),
      readImagerie: meetsActionLevel(scopes.imagerie, "read"),
      readNutrition: meetsActionLevel(scopes.nutrition, "read"),
    };

    // Find the OTHER pro's athletes with the same name
    const otherProAthletes = await (prisma as any).athlete.findMany({
      where: { id: { in: athleteIds }, professionnelId: proId },
      select: { id: true },
    });
    const otherAthleteIds = otherProAthletes.map((a: any) => a.id);

    const result: Record<string, any> = { permissions: perms, dataScopes: scopes };

    // Fetch programme data (KinePlans + Sessions)
    if (meetsActionLevel(scopes.entrainement, "read") && otherAthleteIds.length > 0) {
      const [kinePlans, sessions] = await Promise.all([
        (prisma as any).kinePlan.findMany({
          where: { athleteId: { in: otherAthleteIds }, professionnelId: proId, isTemplate: false },
          include: {
            exercises: {
              include: { video: { select: { title: true, url: true, thumbnail: true } } },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
        (prisma as any).session.findMany({
          where: { athleteId: { in: otherAthleteIds }, professionnelId: proId },
          include: {
            blocks: {
              include: { exercises: true },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { date: "desc" },
          take: 5,
        }),
      ]);
      result.kinePlans = redactRecordsSync("KinePlan", kinePlans, scopes);
      result.sessions = redactRecordsSync("Session", sessions, scopes);
    }

    // Fetch indicators data
    if (meetsActionLevel(scopes.indicateurs, "read") && otherAthleteIds.length > 0) {
      const logs = await (prisma as any).exerciseLog.findMany({
        where: {
          plan: { athleteId: { in: otherAthleteIds }, professionnelId: proId },
        },
        orderBy: { date: "desc" },
        take: 20,
        include: {
          exercise: { select: { video: { select: { title: true } } } },
        },
      });
      // Normalize: add loggedAt alias for frontend compatibility
      result.logs = redactRecordsSync("ExerciseLog", logs, scopes).map((l: any) => ({ ...l, loggedAt: l.date }));
    }

    // Fetch injury/pathology data
    if (meetsActionLevel(scopes.blessures, "read") && otherAthleteIds.length > 0) {
      const athletes = await (prisma as any).athlete.findMany({
        where: { id: { in: otherAthleteIds } },
        select: { id: true, name: true, injuryNote: true, antecedents: true, sport: true, bodyZone: true, motif: true },
      });
      result.athleteInfo = redactRecordsSync("Athlete", athletes, scopes);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/reseau/shared error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
