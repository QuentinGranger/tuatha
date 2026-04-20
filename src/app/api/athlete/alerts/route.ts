import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/alerts?proId=xxx
// Returns alerts linked to the authenticated athlete's plans with a specific pro
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-alerts:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const proId = searchParams.get("proId");
    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }

    // Verify accepted connection with this pro
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Find Athlete record(s) linked to this pro matching the athlete user's email
    const athletes = await (prisma as any).athlete.findMany({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    // Fetch alerts for these athlete records, scoped to this pro
    const alerts = await (prisma as any).kineAlert.findMany({
      where: {
        athleteId: { in: athleteIds },
        professionnelId: proId,
      },
      include: {
        plan: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to a clean response — exclude clinicalNote (private to kiné)
    const result = alerts.map((a: any) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      origin: a.origin,
      title: a.title,
      description: a.description,
      intensity: a.intensity,
      closedAt: a.closedAt,
      planId: a.plan?.id || null,
      planTitle: a.plan?.title || null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({ alerts: result });
  } catch (error) {
    console.error("[athlete/alerts] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/athlete/alerts
// Athlete creates a signalement (always type=alert, origin=patient)
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-alerts-post:${ip}`, RATE_LIMITS.upload);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { proId, title, description, intensity, planId } = body;

    if (!proId) {
      return NextResponse.json({ error: "proId requis" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Titre requis" }, { status: 400 });
    }

    // Verify accepted connection with this pro
    const connection = await prisma.connectionRequest.findFirst({
      where: { athleteUserId: session.id, professionnelId: proId, status: "accepted" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Non connecté" }, { status: 403 });
    }

    // Get athlete user email
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Find Athlete record(s) linked to this pro matching the athlete user's email
    const athletes = await (prisma as any).athlete.findMany({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ error: "Aucun dossier patient trouvé" }, { status: 404 });
    }

    // Use the first athlete record for this pro
    const athleteId = athleteIds[0];

    // If planId provided, verify the plan belongs to this athlete + pro
    if (planId) {
      const plan = await (prisma as any).kinePlan.findFirst({
        where: {
          id: planId,
          athleteId: { in: athleteIds },
          professionnelId: proId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!plan) {
        return NextResponse.json({ error: "Programme introuvable" }, { status: 404 });
      }
    }

    // Validate intensity
    const safeIntensity = typeof intensity === "number" && intensity >= 0 && intensity <= 10 ? intensity : null;

    // Create alert
    const alert = await (prisma as any).kineAlert.create({
      data: {
        type: "alert",
        origin: "patient",
        status: "unread",
        title: title.trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        intensity: safeIntensity,
        athleteId,
        planId: planId || null,
        professionnelId: proId,
      },
      include: {
        plan: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      alert: {
        id: alert.id,
        type: alert.type,
        status: alert.status,
        origin: alert.origin,
        title: alert.title,
        description: alert.description,
        intensity: alert.intensity,
        planId: alert.plan?.id || null,
        planTitle: alert.plan?.title || null,
        createdAt: alert.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[athlete/alerts] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
