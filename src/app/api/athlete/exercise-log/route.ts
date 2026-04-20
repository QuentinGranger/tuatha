import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// POST /api/athlete/exercise-log
// Athlete logs an exercise session
export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const limited = applyRateLimit(`athlete-exercise-log:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { exerciseId, planId, done, pain, difficulty, comment, date } = body;

    if (!exerciseId || !planId) {
      return NextResponse.json({ error: "exerciseId et planId requis" }, { status: 400 });
    }

    // Verify athlete owns this plan (via email match)
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const plan = await (prisma as any).kinePlan.findUnique({
      where: { id: planId },
      select: { athleteId: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    // Verify the athlete record matches
    const athlete = await (prisma as any).athlete.findUnique({
      where: { id: plan.athleteId },
      select: { contactEmail: true },
    });
    if (!athlete || athlete.contactEmail?.toLowerCase() !== athleteUser.email.toLowerCase()) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Verify exercise belongs to plan
    const exercise = await (prisma as any).kinePlanExercise.findFirst({
      where: { id: exerciseId, planId },
    });
    if (!exercise) {
      return NextResponse.json({ error: "Exercice introuvable dans ce plan" }, { status: 404 });
    }

    // Create log entry
    const log = await (prisma as any).exerciseLog.create({
      data: {
        done: done === true,
        pain: typeof pain === "number" && pain >= 0 && pain <= 10 ? pain : null,
        difficulty: typeof difficulty === "number" && difficulty >= 0 && difficulty <= 10 ? difficulty : null,
        comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
        date: date ? new Date(date) : new Date(),
        planId,
        exerciseId,
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("[athlete/exercise-log] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
