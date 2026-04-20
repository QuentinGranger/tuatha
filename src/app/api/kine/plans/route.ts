import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { logAccess } from "@/lib/privacyGuard";
import { validateBody, createKinePlanSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

/**
 * Resolve an athlete ID that may be either an Athlete.id (manual record)
 * or an AthleteUser.id (connected self-registered athlete).
 * If it's an AthleteUser.id, find-or-create a proper Athlete record
 * linked to the pro with contactEmail matching.
 */
async function resolveAthleteId(rawId: string, proId: string): Promise<string | null> {
  if (!rawId) return null;

  // Check if it's already a valid Athlete record for this pro
  const existing = await prisma.athlete.findFirst({
    where: { id: rawId, professionnelId: proId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Check if it's a connected AthleteUser
  const conn = await prisma.connectionRequest.findFirst({
    where: { athleteUserId: rawId, professionnelId: proId, status: "accepted" },
    include: {
      athleteUser: {
        select: { id: true, nom: true, prenom: true, email: true, sport: true },
      },
    },
  });
  if (!conn?.athleteUser) return null;

  const au = conn.athleteUser;

  // Check if a manual Athlete record already exists for this pro + email
  const byEmail = await prisma.athlete.findFirst({
    where: {
      professionnelId: proId,
      contactEmail: { equals: au.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  // Auto-create an Athlete record linked to this pro
  const created = await prisma.athlete.create({
    data: {
      name: `${au.prenom} ${au.nom}`,
      sport: au.sport || null,
      contactEmail: au.email,
      consentement: true,
      consentementDate: new Date(),
      professionnelId: proId,
    },
  });
  return created.id;
}

// GET /api/kine/plans?athleteId=xxx&status=active&template=true
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const { searchParams } = new URL(request.url);
    const rawAthleteId = searchParams.get("athleteId");
    const status = searchParams.get("status");
    const template = searchParams.get("template");

    // Resolve athleteId (may be AthleteUser.id → Athlete.id)
    const athleteId = rawAthleteId ? await resolveAthleteId(rawAthleteId, pro.id) : null;

    const where: any = { professionnelId: pro.id };
    if (rawAthleteId) {
      // If we couldn't resolve, return empty (no valid athlete)
      if (!athleteId) return NextResponse.json([]);
      where.athleteId = athleteId;
    }
    if (status) where.status = status;
    if (template === "true") {
      where.isTemplate = true;
    } else {
      where.isTemplate = false;
    }

    if (rawAthleteId) logAccess(rawAthleteId, pro.id, "view_plan_kine");
    const plans = await (prisma as any).kinePlan.findMany({
      where,
      include: {
        athlete: { select: { id: true, name: true } },
        exercises: {
          include: { video: { select: { id: true, title: true, thumbnail: true, category: true, url: true } } },
          orderBy: { position: "asc" },
        },
        _count: { select: { logs: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET /api/kine/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });

// POST /api/kine/plans — create plan or duplicate
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createKinePlanSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { title, objective, notesPro, notesPatient, startDate, endDate, frequency, athleteId: rawAthleteId, isTemplate, templateName, duplicateFromId } = parsed.data;

    // Resolve athleteId (may be AthleteUser.id → Athlete.id)
    const athleteId = rawAthleteId ? await resolveAthleteId(rawAthleteId, pro.id) : null;

    // Duplicate from existing plan
    if (duplicateFromId) {
      const source = await (prisma as any).kinePlan.findUnique({
        where: { id: duplicateFromId },
        include: { exercises: true },
      });
      if (!source || source.professionnelId !== pro.id) {
        return NextResponse.json({ error: "Plan source introuvable" }, { status: 404 });
      }

      const plan = await (prisma as any).kinePlan.create({
        data: {
          title: title || `${source.title} (copie)`,
          objective: source.objective,
          notesPro: source.notesPro,
          notesPatient: source.notesPatient,
          frequency: source.frequency,
          status: "draft",
          isTemplate: isTemplate || false,
          templateName: templateName || null,
          athleteId: athleteId || null,
          professionnelId: pro.id,
        },
      });

      // Copy exercises
      for (const ex of source.exercises) {
        await (prisma as any).kinePlanExercise.create({
          data: {
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
            planId: plan.id,
            videoId: ex.videoId,
          },
        });
      }

      const full = await (prisma as any).kinePlan.findUnique({
        where: { id: plan.id },
        include: {
          athlete: { select: { id: true, name: true } },
          exercises: { include: { video: true }, orderBy: { position: "asc" } },
        },
      });
      return NextResponse.json(full, { status: 201 });
    }

    // Normal create — always as a real plan (isTemplate: false)
    const plan = await (prisma as any).kinePlan.create({
      data: {
        title,
        objective: objective || null,
        notesPro: notesPro || null,
        notesPatient: notesPatient || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        frequency: frequency || null,
        isTemplate: false,
        athleteId: athleteId || null,
        professionnelId: pro.id,
      },
      include: {
        athlete: { select: { id: true, name: true } },
        exercises: { include: { video: true }, orderBy: { position: "asc" } },
      },
    });

    // Also save as reusable template if requested
    if (isTemplate) {
      await (prisma as any).kinePlan.create({
        data: {
          title,
          objective: objective || null,
          notesPro: notesPro || null,
          notesPatient: notesPatient || null,
          frequency: frequency || null,
          isTemplate: true,
          templateName: templateName || title,
          professionnelId: pro.id,
        },
      });
    }

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("POST /api/kine/plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "kine:plans" });
