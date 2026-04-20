import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/athlete/kine-plans?proId=xxx
// Returns kine plans for the authenticated athlete, filtered by pro
export async function GET(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-kine-plans:${ip}`, RATE_LIMITS.search);
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

    // Find the Athlete record(s) linked to this pro that match the athlete user's email
    const athletes = await (prisma as any).athlete.findMany({
      where: {
        professionnelId: proId,
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ plans: [] });
    }

    // Fetch the pro's name for display
    const pro = await prisma.professionnel.findUnique({
      where: { id: proId },
      select: { nom: true, prenom: true, specialite: true },
    });

    // Fetch plans (non-template, non-draft, non-deleted) for those athlete records
    // Athletes only see active/paused/completed/archived plans (not drafts)
    const plans = await (prisma as any).kinePlan.findMany({
      where: {
        athleteId: { in: athleteIds },
        professionnelId: proId,
        isTemplate: false,
        status: { not: "draft" },
        deletedAt: null,
      },
      include: {
        exercises: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                url: true,
                thumbnail: true,
                category: true,
                duration: true,
                description: true,
              },
            },
            _count: { select: { logs: true } },
          },
          orderBy: { position: "asc" },
        },
        _count: { select: { logs: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const proName = pro ? `${pro.prenom} ${pro.nom}` : null;

    // Map to a clean response — no notesPro (private to kiné)
    const result = plans.map((p: any) => {
      const totalExercises = p.exercises.length;
      const exercisesWithLogs = p.exercises.filter((ex: any) => ex._count.logs > 0).length;
      // Progress: % of exercises that have at least one log entry
      const computedProgress = totalExercises > 0 ? Math.round((exercisesWithLogs / totalExercises) * 100) : 0;
      // Use globalProgress if set by kiné, otherwise compute from logs
      const progress = (p.globalProgress != null && p.globalProgress > 0) ? p.globalProgress : computedProgress;

      return {
        id: p.id,
        title: p.title,
        objective: p.objective,
        pathology: p.pathology,
        phase: p.phase,
        status: p.status,
        progress,
        globalProgress: p.globalProgress,
        notesPatient: p.notesPatient,
        startDate: p.startDate,
        endDate: p.endDate,
        frequency: p.frequency,
        nextRdvDate: p.nextRdvDate,
        nextRdvTime: p.nextRdvTime,
        nextRdvLocation: p.nextRdvLocation,
        conclusion: p.conclusion,
        outcomeScore: p.outcomeScore,
        totalLogs: p._count.logs,
        proName,
        exercises: p.exercises.map((ex: any) => ({
          id: ex.id,
          position: ex.position,
          sets: ex.sets,
          reps: ex.reps,
          duration: ex.duration,
          tempo: ex.tempo,
          rest: ex.rest,
          frequency: ex.frequency,
          painThreshold: ex.painThreshold,
          consignes: ex.consignes,
          equipment: ex.equipment,
          alternative: ex.alternative,
          video: ex.video,
          logsCount: ex._count.logs,
        })),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json({ plans: result });
  } catch (error) {
    console.error("[athlete/kine-plans] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
